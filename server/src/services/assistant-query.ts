/**
 * Structured query contract for the assistant route.
 *
 * The LLM proposes a query in this controlled representation. Every field is
 * validated against the backend-owned registry (see assistant-database.ts)
 * before execution. There is no SQL anywhere in the pipeline.
 */

import { AppError } from '../utils/app-error.js';
import {
  getEntity,
  validateFilterValue,
  type ColumnType,
} from './assistant-database.js';

export const QUERY_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'ilike',
  'like',
  'in',
  'is',
] as const;

export type QueryOperator = (typeof QUERY_OPERATORS)[number];

export type QueryFilter = {
  field: string;
  operator: QueryOperator;
  value: string | number | boolean | null | (string | number)[];
};

export type QueryStats = {
  count?: boolean;
  avg?: string[];
};

export type AssistantQuery = {
  entity: string;
  select?: string[];
  filters?: QueryFilter[];
  include?: string[];
  limit?: number;
  stats?: QueryStats | null;
};

export type GeneratedAssistantQuery = {
  intent: string;
  query: AssistantQuery;
};

export const MIN_QUERY_LIMIT = 1;
export const MAX_QUERY_LIMIT = 50;
export const DEFAULT_QUERY_LIMIT = 20;

/** Length limit for text search values to keep PostgREST/payloads sane. */
const MAX_TEXT_VALUE_LENGTH = 200;

// ── Validation ──────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateOperator(value: unknown): QueryOperator {
  if (typeof value !== 'string' || !QUERY_OPERATORS.includes(value as QueryOperator)) {
    throw new AppError(400, 'QUERY_REJECTED', `Unsupported filter operator: ${String(value)}`);
  }
  return value as QueryOperator;
}

/** Validates a single proposed filter against the entity's allowed columns. */
function validateFilter(entityName: string, raw: unknown, uid: string): QueryFilter {
  if (!isObject(raw)) {
    throw new AppError(400, 'QUERY_REJECTED', 'Each filter must be an object.');
  }

  const field = typeof raw.field === 'string' ? raw.field : undefined;
  const operator = validateOperator(raw.operator);
  const value = raw.value ?? null;

  if (!field) {
    throw new AppError(400, 'QUERY_REJECTED', 'A filter is missing its field name.');
  }

  const entity = getEntity(entityName);
  const columnType: ColumnType | undefined = entity.filterable[field];

  if (!columnType) {
    throw new AppError(
      400,
      'QUERY_REJECTED',
      `Column "${field}" is not filterable on entity "${entityName}".`,
    );
  }

  validateFilterValue({ field, operator, value } as QueryFilter, columnType);

  // Authorization: a private owner column may only ever reference the caller.
  if (field === 'user_id' || field === 'friend_id') {
    if (typeof value === 'string' && value !== uid && entity.scope) {
      throw new AppError(
        403,
        'USER_SCOPE_VIOLATION',
        `Queries about another user's private data are not allowed.`,
      );
    }
  }

  if (
    (operator === 'ilike' || operator === 'like') &&
    typeof value === 'string' &&
    value.length > MAX_TEXT_VALUE_LENGTH
  ) {
    throw new AppError(400, 'QUERY_REJECTED', 'Text filter values are too long.');
  }

  return { field, operator, value: value as QueryFilter['value'] };
}

/**
 * Strictly validates a proposed structured query. Rejects unsupported
 * entities, columns, relationships, operators, and limits.
 */
export function validateAssistantQuery(raw: unknown, uid: string): AssistantQuery {
  if (!isObject(raw)) {
    throw new AppError(400, 'QUERY_REJECTED', 'The proposed query must be an object.');
  }

  // Strict allow-list: any other field (e.g. "sql", "operation") is rejected so
  // the generator can never smuggle arbitrary or mutating instructions.
  const ALLOWED_QUERY_KEYS = new Set(['entity', 'select', 'filters', 'include', 'limit', 'stats']);
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      throw new AppError(400, 'QUERY_REJECTED', `Unsupported query field: ${key}`);
    }
  }

  if (typeof raw.entity !== 'string' || !raw.entity.trim()) {
    throw new AppError(400, 'QUERY_REJECTED', 'The proposed query is missing an entity.');
  }

  const entityName = raw.entity.trim();
  const entity = getEntity(entityName);

  const select: string[] = [];
  if (raw.select !== undefined) {
    if (!Array.isArray(raw.select) || raw.select.some((c) => typeof c !== 'string')) {
      throw new AppError(400, 'QUERY_REJECTED', '"select" must be an array of column names.');
    }
    for (const column of raw.select) {
      if (!entity.selectable.includes(column)) {
        throw new AppError(
          400,
          'QUERY_REJECTED',
          `Column "${column}" is not exposed on entity "${entityName}".`,
        );
      }
    }
    select.push(...raw.select);
  }

  const include: string[] = [];
  if (raw.include !== undefined) {
    if (!Array.isArray(raw.include) || raw.include.some((r) => typeof r !== 'string')) {
      throw new AppError(400, 'QUERY_REJECTED', '"include" must be an array of relationship names.');
    }
    for (const relation of raw.include) {
      if (!entity.relations[relation]) {
        throw new AppError(
          400,
          'QUERY_REJECTED',
          `Relationship "${relation}" is not supported on entity "${entityName}".`,
        );
      }
    }
    include.push(...raw.include);
  }

  const filters: QueryFilter[] = [];
  if (raw.filters !== undefined) {
    if (!Array.isArray(raw.filters)) {
      throw new AppError(400, 'QUERY_REJECTED', '"filters" must be an array.');
    }
    if (raw.filters.length > 20) {
      throw new AppError(400, 'QUERY_REJECTED', 'Too many filters in the proposed query.');
    }
    for (const candidate of raw.filters) {
      filters.push(validateFilter(entityName, candidate, uid));
    }
  }

  let limit = DEFAULT_QUERY_LIMIT;
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== 'number' || !Number.isInteger(raw.limit)) {
      throw new AppError(400, 'QUERY_REJECTED', '"limit" must be an integer.');
    }
    limit = Math.min(Math.max(raw.limit, MIN_QUERY_LIMIT), MAX_QUERY_LIMIT);
  }

  let stats: QueryStats | undefined;
  if (raw.stats !== undefined && raw.stats !== null) {
    if (!isObject(raw.stats)) {
      throw new AppError(400, 'QUERY_REJECTED', '"stats" must be an object.');
    }
    if (entityName !== 'course_reviews' && entityName !== 'professor_reviews') {
      throw new AppError(
        400,
        'QUERY_REJECTED',
        `Aggregate stats are only supported for review entities, not "${entityName}".`,
      );
    }
    if (raw.stats.avg !== undefined) {
      if (!Array.isArray(raw.stats.avg)) {
        throw new AppError(400, 'QUERY_REJECTED', '"stats.avg" must be an array.');
      }
      for (const field of raw.stats.avg) {
        if (field !== 'rating' && field !== 'difficulty' && field !== 'workload') {
          throw new AppError(
            400,
            'QUERY_REJECTED',
            `Unsupported aggregate field: ${String(field)}`,
          );
        }
      }
    }
    stats = { ...(raw.stats.count === true ? { count: true } : {}), ...(raw.stats.avg ? { avg: raw.stats.avg as string[] } : {}) };
  }

  return {
    entity: entityName,
    ...(select.length ? { select } : {}),
    ...(filters.length ? { filters } : {}),
    ...(include.length ? { include } : {}),
    ...(limit !== DEFAULT_QUERY_LIMIT ? { limit } : {}),
    ...(stats ? { stats } : {}),
  };
}

/**
 * Parses and validates the JSON object returned by the query-generation LLM.
 * The response may wrap the query in an `{ intent, query }` envelope (preferred)
 * or be the query object itself.
 */
export function parseGeneratedQuery(raw: unknown, uid: string): { intent: string; query: AssistantQuery } {
  if (!isObject(raw)) {
    throw new AppError(400, 'QUERY_REJECTED', 'The query generator returned a non-object payload.');
  }

  const inner =
    isObject(raw.query) ? (raw.query as Record<string, unknown>) : raw;

  const intent =
    typeof raw.intent === 'string' && raw.intent.trim() ? raw.intent.trim() : 'request';

  return { intent, query: validateAssistantQuery(inner, uid) };
}