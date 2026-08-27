/**
 * Controlled database access for the AI assistant.
 *
 * This module owns the entire database surface the assistant is allowed to
 * touch:
 *
 * - approved entities (tables) and their fallback column sets
 * - approved filter columns and their value types
 * - approved relationship paths (owned by the backend, never the LLM)
 * - read-only, limit-bounded execution against Supabase
 * - automatic authorization scoping for private user data
 *
 * The LLM proposes a structured query; every field of that query is validated
 * here against this registry before anything touches Supabase. No raw SQL is
 * ever constructed, so multi-statement or mutation SQL is impossible.
 */

import { requireSupabaseClient } from '../db/supabase.js';
import { AppError } from '../utils/app-error.js';
import type { AssistantQuery, QueryFilter } from './assistant-query.js';

export type ColumnType = 'string' | 'number' | 'boolean' | 'date_time' | 'uuid';

export type RelationDef = {
  /** PostgREST embed path for foreign-key relationships. */
  postgrest: string;
  /** The explicit projection for the embedded resource(s). */
  select: string;
};

export type EntityScope =
  | { type: 'column'; column: string }
  | { type: 'friendships' }
  | { type: 'schedule_sections' };

export type EntityDef = {
  /** LLM-facing entity name (plural table-style name). */
  name: string;
  /** Actual Supabase table. */
  table: string;
  /** Columns returned when the query does not specify a projection. */
  defaultSelect: readonly string[];
  /** Columns the LLM may select. Never a wildcard. */
  selectable: readonly string[];
  /** Columns the LLM may filter on, with their value type. */
  filterable: Readonly<Record<string, ColumnType>>;
  /** Backend-owned relationship graph. */
  relations: Readonly<Record<string, RelationDef>>;
  /** Private data — automatically scoped to the authenticated user. */
  scope?: EntityScope;
};

type EntityRow = {
  name: string;
  table: string;
  defaultSelect: string[];
  selectable: string[];
  filterable: { [field: string]: ColumnType };
  relations: { [key: string]: RelationDef };
  scope?: EntityScope;
};

// ── Entity definitions ──────────────────────────────────────────────────────

const SECTIONS_PROJECTION =
  'id, course_id, term_id, professor_id, section_number, crn, schedule_type, campus, room, days, start_time, end_time, seats_total, seats_remaining, status, link_identifier, meeting_schedule_type';
const COURSES_PROJECTION = 'id, subject, course_number, title, credits, level, college, department';
const PROFESSORS_PROJECTION = 'id, first_name, last_name, department, title';

const SECTION_WITH_COURSE =
  `${SECTIONS_PROJECTION}, courses(${COURSES_PROJECTION}), professors(${PROFESSORS_PROJECTION}), ` +
  'section_meetings(id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type)';

const ENTITY_ROWS: EntityRow[] = [
  {
    name: 'terms',
    table: 'terms',
    defaultSelect: ['id', 'name', 'start_date', 'end_date'],
    selectable: ['id', 'name', 'start_date', 'end_date'],
    filterable: { id: 'number', name: 'string', start_date: 'date_time', end_date: 'date_time' },
    relations: {},
  },
  {
    name: 'courses',
    table: 'courses',
    defaultSelect: ['id', 'subject', 'course_number', 'title', 'credits', 'level', 'college', 'department'],
    selectable: ['id', 'subject', 'course_number', 'title', 'credits', 'level', 'college', 'department'],
    filterable: {
      id: 'number',
      subject: 'string',
      course_number: 'string',
      title: 'string',
      credits: 'string',
      level: 'string',
      college: 'string',
      department: 'string',
    },
    relations: {
      sections: {
        postgrest: 'sections',
        select: `${SECTIONS_PROJECTION}, professors(${PROFESSORS_PROJECTION}), section_meetings(id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type)`,
      },
      attributes: {
        postgrest: 'course_attributes',
        select: 'attributes(id, name)',
      },
      reviews: {
        postgrest: 'course_reviews',
        select: 'id, rating, difficulty, workload, would_retake, comment, created_at',
      },
      grade_distributions: {
        postgrest: 'course_grade_distributions',
        select: 'id, grade, percentage, term_id',
      },
    },
  },
  {
    name: 'professors',
    table: 'professors',
    defaultSelect: ['id', 'first_name', 'last_name', 'department', 'title'],
    selectable: ['id', 'first_name', 'last_name', 'department', 'title'],
    filterable: {
      id: 'number',
      first_name: 'string',
      last_name: 'string',
      department: 'string',
      title: 'string',
    },
    relations: {
      sections: {
        postgrest: 'sections',
        select: `${SECTIONS_PROJECTION}, courses(${COURSES_PROJECTION}), section_meetings(id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type)`,
      },
      reviews: {
        postgrest: 'professor_reviews',
        select: 'id, rating, difficulty, would_retake, comment, created_at',
      },
    },
  },
  {
    name: 'sections',
    table: 'sections',
    defaultSelect: SECTIONS_PROJECTION.split(', '),
    selectable: SECTIONS_PROJECTION.split(', '),
    filterable: {
      id: 'number',
      course_id: 'number',
      term_id: 'number',
      professor_id: 'number',
      section_number: 'string',
      crn: 'string',
      schedule_type: 'string',
      campus: 'string',
      seats_total: 'number',
      seats_remaining: 'number',
      status: 'string',
      room: 'string',
      days: 'string',
      start_time: 'date_time',
      end_time: 'date_time',
      link_identifier: 'string',
      meeting_schedule_type: 'string',
    },
    relations: {
      course: { postgrest: 'courses', select: COURSES_PROJECTION },
      professor: { postgrest: 'professors', select: PROFESSORS_PROJECTION },
      meetings: {
        postgrest: 'section_meetings',
        select:
          'id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type',
      },
      term: { postgrest: 'terms', select: 'id, name, start_date, end_date' },
    },
  },
  {
    name: 'section_meetings',
    table: 'section_meetings',
    defaultSelect: [
      'id',
      'section_id',
      'term_id',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'start_time',
      'end_time',
      'building',
      'room',
      'meeting_type',
    ],
    selectable: [
      'id',
      'section_id',
      'term_id',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'start_time',
      'end_time',
      'building',
      'room',
      'meeting_type',
    ],
    filterable: {
      id: 'number',
      section_id: 'number',
      term_id: 'number',
      monday: 'boolean',
      tuesday: 'boolean',
      wednesday: 'boolean',
      thursday: 'boolean',
      friday: 'boolean',
      saturday: 'boolean',
      sunday: 'boolean',
      start_time: 'date_time',
      end_time: 'date_time',
      building: 'string',
      room: 'string',
      meeting_type: 'string',
    },
    relations: {
      section: { postgrest: 'sections', select: 'id, section_number, crn, schedule_type' },
      term: { postgrest: 'terms', select: 'id, name' },
    },
  },
  {
    name: 'attributes',
    table: 'attributes',
    defaultSelect: ['id', 'name'],
    selectable: ['id', 'name'],
    filterable: { id: 'number', name: 'string' },
    relations: {},
  },
  {
    name: 'course_attributes',
    table: 'course_attributes',
    defaultSelect: ['course_id', 'attribute_id'],
    selectable: ['course_id', 'attribute_id'],
    filterable: { course_id: 'number', attribute_id: 'number' },
    relations: {
      course: { postgrest: 'courses', select: COURSES_PROJECTION },
      attribute: { postgrest: 'attributes', select: 'id, name' },
    },
  },
  {
    name: 'course_reviews',
    table: 'course_reviews',
    defaultSelect: [
      'id',
      'user_id',
      'course_id',
      'rating',
      'difficulty',
      'workload',
      'would_retake',
      'comment',
      'created_at',
    ],
    selectable: [
      'id',
      'user_id',
      'course_id',
      'rating',
      'difficulty',
      'workload',
      'would_retake',
      'comment',
      'created_at',
    ],
    filterable: {
      id: 'number',
      user_id: 'uuid',
      course_id: 'number',
      rating: 'number',
      difficulty: 'number',
      workload: 'number',
      would_retake: 'boolean',
      created_at: 'date_time',
    },
    relations: {
      course: { postgrest: 'courses', select: COURSES_PROJECTION },
      user: { postgrest: 'users', select: 'id, first_name, last_name' },
    },
  },
  {
    name: 'professor_reviews',
    table: 'professor_reviews',
    defaultSelect: [
      'id',
      'user_id',
      'professor_id',
      'rating',
      'difficulty',
      'would_retake',
      'comment',
      'created_at',
    ],
    selectable: [
      'id',
      'user_id',
      'professor_id',
      'rating',
      'difficulty',
      'would_retake',
      'comment',
      'created_at',
    ],
    filterable: {
      id: 'number',
      user_id: 'uuid',
      professor_id: 'number',
      rating: 'number',
      difficulty: 'number',
      would_retake: 'boolean',
      created_at: 'date_time',
    },
    relations: {
      professor: { postgrest: 'professors', select: PROFESSORS_PROJECTION },
      user: { postgrest: 'users', select: 'id, first_name, last_name' },
    },
  },
  {
    name: 'course_grade_distributions',
    table: 'course_grade_distributions',
    defaultSelect: ['id', 'course_id', 'term_id', 'grade', 'percentage'],
    selectable: ['id', 'course_id', 'term_id', 'grade', 'percentage'],
    filterable: {
      id: 'number',
      course_id: 'number',
      term_id: 'number',
      grade: 'string',
      percentage: 'number',
    },
    relations: {
      course: { postgrest: 'courses', select: 'id, subject, course_number, title' },
      term: { postgrest: 'terms', select: 'id, name' },
    },
  },
  {
    name: 'users',
    table: 'users',
    defaultSelect: ['id', 'first_name', 'last_name', 'major', 'level'],
    // NOTE: email is deliberately NOT selectable — it is private.
    selectable: ['id', 'first_name', 'last_name', 'major', 'level'],
    filterable: {
      id: 'uuid',
      first_name: 'string',
      last_name: 'string',
      major: 'string',
      level: 'string',
    },
    relations: {
      posts: { postgrest: 'posts', select: 'id, type, content, created_at' },
    },
  },
  {
    name: 'schedules',
    table: 'schedules',
    defaultSelect: ['id', 'user_id', 'term_id', 'name', 'notes', 'created_at', 'updated_at'],
    selectable: ['id', 'user_id', 'term_id', 'name', 'notes', 'created_at', 'updated_at'],
    filterable: {
      id: 'number',
      user_id: 'uuid',
      term_id: 'number',
      name: 'string',
      created_at: 'date_time',
      updated_at: 'date_time',
    },
    relations: {
      sections: {
        postgrest: 'schedule_sections',
        select:
          'schedule_id, section_id, sections(' +
          `${SECTIONS_PROJECTION}, courses(${COURSES_PROJECTION}), professors(${PROFESSORS_PROJECTION}), ` +
          'section_meetings(id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type))',
      },
      term: { postgrest: 'terms', select: 'id, name, start_date, end_date' },
    },
    scope: { type: 'column', column: 'user_id' },
  },
  {
    name: 'schedule_sections',
    table: 'schedule_sections',
    defaultSelect: ['id', 'schedule_id', 'section_id'],
    selectable: ['id', 'schedule_id', 'section_id'],
    filterable: { id: 'number', schedule_id: 'number', section_id: 'number' },
    relations: {
      section: { postgrest: 'sections', select: SECTION_WITH_COURSE },
      schedule: { postgrest: 'schedules', select: 'id, name, notes, term_id' },
    },
    scope: { type: 'schedule_sections' },
  },
  {
    name: 'course_saves',
    table: 'course_saves',
    defaultSelect: ['user_id', 'course_id', 'created_at'],
    selectable: ['user_id', 'course_id', 'created_at'],
    filterable: { user_id: 'uuid', course_id: 'number', created_at: 'date_time' },
    relations: {
      course: { postgrest: 'courses', select: COURSES_PROJECTION },
    },
    scope: { type: 'column', column: 'user_id' },
  },
  {
    name: 'posts',
    table: 'posts',
    defaultSelect: ['id', 'user_id', 'type', 'content', 'tags', 'created_at'],
    selectable: ['id', 'user_id', 'type', 'content', 'tags', 'created_at'],
    filterable: {
      id: 'number',
      user_id: 'uuid',
      type: 'string',
      content: 'string',
      created_at: 'date_time',
    },
    relations: {
      author: { postgrest: 'users', select: 'id, first_name, last_name' },
      comments: {
        postgrest: 'post_comments',
        select: 'id, user_id, content, created_at, users(id, first_name, last_name)',
      },
    },
  },
  {
    name: 'post_comments',
    table: 'post_comments',
    defaultSelect: ['id', 'post_id', 'user_id', 'content', 'created_at'],
    selectable: ['id', 'post_id', 'user_id', 'content', 'created_at'],
    filterable: {
      id: 'number',
      post_id: 'number',
      user_id: 'uuid',
      content: 'string',
      created_at: 'date_time',
    },
    relations: {
      author: { postgrest: 'users', select: 'id, first_name, last_name' },
      post: { postgrest: 'posts', select: 'id, type, content, created_at' },
    },
  },
  {
    name: 'events',
    table: 'events',
    defaultSelect: ['id', 'title', 'type', 'starts_at', 'ends_at', 'description', 'location', 'term_id'],
    selectable: ['id', 'title', 'type', 'starts_at', 'ends_at', 'description', 'location', 'term_id'],
    filterable: {
      id: 'number',
      title: 'string',
      type: 'string',
      starts_at: 'date_time',
      ends_at: 'date_time',
      location: 'string',
      term_id: 'number',
    },
    relations: {
      term: { postgrest: 'terms', select: 'id, name' },
    },
  },
  {
    name: 'event_rsvps',
    table: 'event_rsvps',
    defaultSelect: ['event_id', 'user_id', 'created_at'],
    selectable: ['event_id', 'user_id', 'created_at'],
    filterable: { event_id: 'number', user_id: 'uuid', created_at: 'date_time' },
    relations: {
      event: {
        postgrest: 'events',
        select: 'id, title, type, starts_at, ends_at, description, location',
      },
      user: { postgrest: 'users', select: 'id, first_name, last_name' },
    },
    scope: { type: 'column', column: 'user_id' },
  },
  {
    name: 'study_groups',
    table: 'study_groups',
    defaultSelect: [
      'id',
      'name',
      'course_code',
      'description',
      'meeting_time',
      'location',
      'host_user_id',
      'max_members',
      'created_at',
    ],
    selectable: [
      'id',
      'name',
      'course_code',
      'description',
      'meeting_time',
      'location',
      'host_user_id',
      'max_members',
      'created_at',
    ],
    filterable: {
      id: 'number',
      name: 'string',
      course_code: 'string',
      meeting_time: 'string',
      location: 'string',
      host_user_id: 'uuid',
      max_members: 'number',
      created_at: 'date_time',
    },
    relations: {
      host: { postgrest: 'users', select: 'id, first_name, last_name' },
      members: {
        postgrest: 'study_group_members',
        select: 'user_id, joined_at, users(id, first_name, last_name)',
      },
    },
  },
  {
    name: 'study_group_members',
    table: 'study_group_members',
    defaultSelect: ['study_group_id', 'user_id', 'joined_at'],
    selectable: ['study_group_id', 'user_id', 'joined_at'],
    filterable: { study_group_id: 'number', user_id: 'uuid', joined_at: 'date_time' },
    relations: {
      user: { postgrest: 'users', select: 'id, first_name, last_name' },
      group: { postgrest: 'study_groups', select: 'id, name, course_code' },
    },
  },
  {
    name: 'friendships',
    table: 'friendships',
    defaultSelect: ['id', 'user_id', 'friend_id', 'status', 'created_at'],
    selectable: ['id', 'user_id', 'friend_id', 'status', 'created_at'],
    filterable: {
      id: 'number',
      user_id: 'uuid',
      friend_id: 'uuid',
      status: 'string',
      created_at: 'date_time',
    },
    relations: {
      friend: { postgrest: 'users', select: 'id, first_name, last_name, major' },
      user: { postgrest: 'users', select: 'id, first_name, last_name' },
    },
    scope: { type: 'friendships' },
  },
];

const ENTITIES = new Map<string, EntityDef>();
for (const row of ENTITY_ROWS) {
  ENTITIES.set(row.name, {
    name: row.name,
    table: row.table,
    defaultSelect: row.defaultSelect,
    selectable: row.selectable,
    filterable: row.filterable,
    relations: row.relations,
    ...(row.scope ? { scope: row.scope } : {}),
  });
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function isKnownEntity(name: string): boolean {
  return ENTITIES.has(name);
}

export function getEntity(name: string): EntityDef {
  const entity = ENTITIES.get(name);
  if (!entity) {
    throw new AppError(400, 'UNSUPPORTED_ENTITY', `Unsupported entity: ${name}`);
  }
  return entity;
}

export function listEntityNames(): string[] {
  return [...ENTITIES.keys()];
}

// ── Query execution ─────────────────────────────────────────────────────────

export type StatsResult = {
  count: number;
  avgRating?: number | null;
  avgDifficulty?: number | null;
  avgWorkload?: number | null;
  wouldRetakePercentage?: number | null;
};

type ReviewFields = {
  rating?: number | null;
  difficulty?: number | null;
  workload?: number | null;
  would_retake?: boolean | null;
};

const STATS_AVG_FIELDS = new Set(['rating', 'difficulty', 'workload']);

function average(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

function computeStats(rows: ReviewFields[], avg: string[]): StatsResult {
  const stats: StatsResult = { count: rows.length };
  for (const field of avg) {
    const values = rows.flatMap((row) =>
      typeof row[field as keyof ReviewFields] === 'number'
        ? [(row as ReviewFields)[field as keyof ReviewFields] as number]
        : [],
    );
    if (field === 'rating') stats.avgRating = average(values);
    if (field === 'difficulty') stats.avgDifficulty = average(values);
    if (field === 'workload') stats.avgWorkload = average(values);
  }
  const retakes = rows.flatMap((row) =>
    row.would_retake === null || row.would_retake === undefined ? [] : [row.would_retake],
  );
  if (retakes.length) {
    stats.wouldRetakePercentage =
      Math.round((retakes.filter(Boolean).length / retakes.length) * 1000) / 10;
  }
  return stats;
}

/** Applies a single validated filter via the Supabase query builder. */
function applyFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builder: any,
  filter: QueryFilter,
  columnType: ColumnType,
): void {
  const { field, operator, value } = filter;

  switch (operator) {
    case 'eq':
      builder.eq(field, value);
      return;
    case 'neq':
      builder.neq(field, value);
      return;
    case 'gt':
      builder.gt(field, value);
      return;
    case 'gte':
      builder.gte(field, value);
      return;
    case 'lt':
      builder.lt(field, value);
      return;
    case 'lte':
      builder.lte(field, value);
      return;
    case 'like':
      builder.like(field, String(value));
      return;
    case 'ilike': {
      const text = String(value);
      const pattern = text.includes('%') || text.includes('_') ? text : `%${text}%`;
      builder.ilike(field, pattern);
      return;
    }
    case 'in': {
      if (!Array.isArray(value)) {
        throw new AppError(400, 'QUERY_REJECTED', `Filter "${field}" uses "in" without an array.`);
      }
      builder.in(field, value);
      return;
    }
    case 'is': {
      if (value === null) {
        builder.is(field, null);
      } else if (typeof value === 'boolean' && columnType === 'boolean') {
        builder.eq(field, value);
      } else {
        throw new AppError(400, 'QUERY_REJECTED', `Filter "${field}" uses an invalid "is" value.`);
      }
      return;
    }
    /* c8 ignore next 2 -- exhaustive switch guarded by validation */
    default:
      throw new AppError(400, 'QUERY_REJECTED', `Unsupported operator: ${operator}`);
  }
}

/** Rejects any attempt to scope private data to a user other than the caller. */
function applyUserScoping(entity: EntityDef, query: AssistantQuery, userId: string): void {
  const ownerFilters = (query.filters ?? []).filter(
    (filter) => filter.field === 'user_id' || filter.field === 'friend_id',
  );
  for (const filter of ownerFilters) {
    if (filter.value !== null && filter.value !== userId) {
      throw new AppError(
        403,
        'USER_SCOPE_VIOLATION',
        `Queries about another user's private data are not allowed.`,
      );
    }
  }
}

async function scopedScheduleSectionIds(userId: string): Promise<number[]> {
  const db = requireSupabaseClient();
  const { data, error } = await db.from('schedules').select('id').eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => (row as { id: number }).id);
}

/** Validates a filter value against the column type. Throws on mismatch. */
export function validateFilterValue(filter: QueryFilter, columnType: ColumnType): void {
  const { operator, value } = filter;

  if (operator === 'in') {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' && typeof item !== 'number')) {
      throw new AppError(400, 'QUERY_REJECTED', `Filter "${filter.field}" must use a scalar array.`);
    }
    return;
  }

  // Null values are only meaningful for the "is" operator.
  if (value === null && operator !== 'is') {
    throw new AppError(
      400,
      'QUERY_REJECTED',
      `Filter "${filter.field}" cannot use null with the "${operator}" operator.`,
    );
  }

  if (operator === 'is') {
    if (value !== null && columnType !== 'boolean') {
      throw new AppError(400, 'QUERY_REJECTED', `Filter "${filter.field}" has an invalid "is" value.`);
    }
    return;
  }

  const isTextOperator = operator === 'ilike' || operator === 'like';

  if (columnType === 'number') {
    if (isTextOperator || (typeof value !== 'number' && value !== null)) {
      throw new AppError(400, 'QUERY_REJECTED', `Filter "${filter.field}" expects a number.`);
    }
    return;
  }

  if (columnType === 'uuid') {
    if (isTextOperator || (typeof value !== 'string' && value !== null)) {
      throw new AppError(400, 'QUERY_REJECTED', `Filter "${filter.field}" expects a UUID.`);
    }
    return;
  }

  if (columnType === 'boolean') {
    if (typeof value !== 'boolean' && value !== null) {
      throw new AppError(400, 'QUERY_REJECTED', `Filter "${filter.field}" expects a boolean.`);
    }
    return;
  }

  if (columnType === 'string' || columnType === 'date_time') {
    // Accept string or number values (numbers are coerced by PostgREST).
    if (typeof value !== 'string' && typeof value !== 'number' && value !== null) {
      throw new AppError(400, 'QUERY_REJECTED', `Filter "${filter.field}" has an invalid value.`);
    }
    return;
  }
}

/**
 * Executes a validated, read-only assistant query.
 *
 * All projection, filter, relationship, limit, and authorization decisions are
 * made here against the backend-owned registry. The function never builds raw
 * SQL; it only builds parameterized PostgREST chains.
 */
export async function executeAssistantQuery(
  query: AssistantQuery,
  userId: string,
): Promise<{ rows: Record<string, unknown>[]; stats?: StatsResult }> {
  const entity = getEntity(query.entity);
  const db = requireSupabaseClient();

  applyUserScoping(entity, query, userId);

  // Enforce limits (bounded results). Never allow an unbounded response.
  const limit = query.limit ?? 20;

  const selectColumns = (query.select ?? entity.defaultSelect).map((column) => column.trim());
  const includeSelects = (query.include ?? []).map((relationName) => {
    const relation = entity.relations[relationName];
    if (!relation) {
      throw new AppError(
        400,
        'QUERY_REJECTED',
        `Entity "${entity.name}" has no "${relationName}" relationship to include.`,
      );
    }
    return relation;
  });

  const selectString = [
    ...selectColumns,
    ...includeSelects.map((relation) => `${relation.postgrest}(${relation.select})`),
  ].join(', ');

  let builder = db.from(entity.table).select(selectString);

  // Authorization scoping for private entities — decided by backend code.
  const scope = entity.scope;
  if (scope?.type === 'column') {
    builder = builder.eq(scope.column, userId);
  } else if (scope?.type === 'friendships') {
    builder = builder.or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  } else if (scope?.type === 'schedule_sections') {
    const scheduleIds = await scopedScheduleSectionIds(userId);
    if (scheduleIds.length === 0) {
      return { rows: [] };
    }
    builder = builder.in('schedule_id', scheduleIds);
  }

  for (const filter of query.filters ?? []) {
    const columnType = entity.filterable[filter.field];
    /* istanbul ignore next -- validation guarantees a filterable column */
    if (!columnType) {
      throw new AppError(400, 'QUERY_REJECTED', `Column "${filter.field}" is not exposed.`);
    }
    applyFilter(builder, filter, columnType);
  }

  const wantsStats = query.stats && query.stats.avg?.length;

  // For review entities with stats, compute bounded aggregates over the whole
  // (single-course / single-professor) filtered set, then return a limited slice.
  if (
    wantsStats &&
    (query.entity === 'course_reviews' || query.entity === 'professor_reviews')
  ) {
    const scopingField = query.entity === 'course_reviews' ? 'course_id' : 'professor_id';
    const hasScopingFilter = (query.filters ?? []).some((filter) => filter.field === scopingField);
    if (!hasScopingFilter) {
      throw new AppError(
        400,
        'QUERY_REJECTED',
        `Aggregate queries on ${query.entity} must filter by ${scopingField}.`,
      );
    }

    const all = await builder;
    if (all.error) {
      throw all.error;
    }

    const rows = (all.data ?? []) as unknown as ReviewFields[];
    const stats = computeStats(rows, (query.stats?.avg ?? []).filter((f) => STATS_AVG_FIELDS.has(f)));
    return { rows: rows.slice(0, limit) as unknown as Record<string, unknown>[], stats };
  }

  const result = await builder.limit(limit);

  if (result.error) {
    throw result.error;
  }

  return { rows: (result.data ?? []) as unknown as Record<string, unknown>[] };
}