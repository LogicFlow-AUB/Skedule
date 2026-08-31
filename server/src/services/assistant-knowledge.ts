/**
 * Controlled schema description handed to the query-generation LLM.
 *
 * Only tables/columns/relationships registered here can ever be queried: the
 * description is generated directly from the same registry the executor uses,
 * so the model can never be told about a surface that does not exist.
 */

import {
  listEntityNames,
  getEntity,
  type EntityDef,
  type ColumnType,
} from './assistant-database.js';

const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  string: 'text',
  number: 'number',
  boolean: 'boolean',
  date_time: 'date/time string (ISO 8601, e.g. "2026-01-15" or "08:30:00")',
  uuid: 'uuid (string)',
};

function describeRelations(entity: EntityDef): string {
  const names = Object.keys(entity.relations);
  if (names.length === 0) {
    return 'none';
  }
  return names
    .map((name) => {
      const relation = entity.relations[name];
      /* istanbul ignore next -- names come from the registry itself */
      if (!relation) {
        return '';
      }
      const embedded = relation.postgrest.split('(')[0];
      return `${entity.name}.${name} → ${embedded} (embed via "include": ["${name}"])`;
    })
    .filter(Boolean)
    .join('; ');
}

function describeEntity(entity: EntityDef): string {
  const columns = entity.selectable.map((column) => {
    const type = entity.filterable[column];
    const filterable = type ? `filterable (${COLUMN_TYPE_LABELS[type]})` : 'selectable only';
    return `    - ${column} (${filterable})`;
  });

  return [
    `table "${entity.table}" (entity name: "${entity.name}")`,
    ...columns,
    `  relationships: ${describeRelations(entity)}`,
    ...(entity.scope ? ['  NOTE: private data — automatically restricted to the signed-in user.'] : []),
  ].join('\n');
}

/** Builds the full schema knowledge block used in the query-generator prompt. */
export function buildSchemaKnowledge(): string {
  const tableDescriptions = listEntityNames()
    .map((name) => describeEntity(getEntity(name)))
    .join('\n\n');

  return [
    '## Available database knowledge',
    '',
    'The database contains the following approved entities. You may ONLY query these entities, ',
    'ONLY the columns listed per entity, and ONLY the relationships listed per entity.',
    '',
    tableDescriptions,
    '',
    '## Rules',
    '',
    '- Queries are strictly READ-ONLY. You can only request information retrieval.',
    '- You may never generate SQL of any kind.',
    '- You may never request INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, or multi-statement operations.',
    '- Joins may only follow the relationships listed above. Never invent a relationship.',
    '- Every query must be limited; keep results small (1–20 rows, at most 50).',
    '- Private entities (schedules, schedule_sections, course_saves, event_rsvps, friendships) are ',
    "  automatically limited to the signed-in user. Never guess another user's data.",
    '- On "schedules": a row with saved=false is the user\'s current working draft for its term',
    "  (at most one per user+term). saved=true means a permanently saved schedule. The single",
    '  row with is_favorite=true per user is their favourite saved schedule. When the user asks',
    '  about "my current schedule", "my draft", or the schedule in the builder, prefer the',
    '  saved=false draft. When they ask about saved/favourite schedules, read rows with',
    '  saved=true / is_favorite=true. Generating new schedules is NOT available in chat.',
    '',
  ].join('\n');
}

/** Builds the strict structured-query format instructions. */
export function buildQueryFormatInstructions(): string {
  return [
    '## Output format',
    '',
    'Respond with ONLY a JSON object (no prose, no markdown) using this exact shape:',
    '',
    '```json',
    '{',
    '  "intent": "short_label_of_the_user_request",',
    '  "query": {',
    '    "entity": "one_of_the_entities_above",',
    '    "select": ["allowed_column", "..."],',
    '    "filters": [',
    '      { "field": "allowed_filterable_column", "operator": "eq|neq|gt|gte|lt|lte|ilike|like|in|is", "value": ... }',
    '    ],',
    '    "include": ["allowed_relationship", "..."],',
    '    "limit": 20',
    '  }',
    '}',
    '```',
    '',
    '- "select" is optional (omit to use sensible defaults). Only use permitted columns.',
    '- "filters" is optional. Use "ilike" for partial text matches (e.g. subject contains "CMPS").',
    '- "include" is optional and only allows listed relationships (e.g. sections → "professor").',
    '- "limit" is optional, between 1 and 50. Prefer small limits; pick the rows most relevant to the request.',
    '- Use "stats" ONLY on course_reviews / professor_reviews when the user asks for averages, e.g.',
    '  { "entity": "professor_reviews", "filters": [{ "field": "professor_id", "operator": "eq", "value": 7 }], "stats": { "avg": ["rating", "difficulty"] }, "limit": 20 }',
    '  and ALWAYS filter by course_id (course_reviews) or professor_id (professor_reviews) when computing stats.',
    '',
    'If the user request is not about data retrieval (greetings, chit-chat, or anything the database ',
    'cannot answer), respond with: {"intent": "no_query", "query": null}.',
    '',
  ].join('\n');
}