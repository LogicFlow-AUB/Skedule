import { describe, expect, it } from 'vitest';

import { AppError } from '../src/utils/app-error.js';
import {
  DEFAULT_QUERY_LIMIT,
  MAX_QUERY_LIMIT,
  MIN_QUERY_LIMIT,
  QUERY_OPERATORS,
  parseGeneratedQuery,
  validateAssistantQuery,
} from '../src/services/assistant-query.js';

const USER = '5bdce3e1-b0e4-49e6-b4ca-7432bf8937c4';
const OTHER_USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('assistant query validation', () => {
  it('accepts a well-formed courses query and clamps its limit', () => {
    const query = validateAssistantQuery(
      {
        entity: 'courses',
        select: ['id', 'title', 'subject', 'course_number'],
        filters: [{ field: 'subject', operator: 'eq', value: 'CMPS' }],
        include: ['sections'],
        limit: 5,
      },
      USER,
    );

    expect(query.entity).toBe('courses');
    expect(query.select).toContain('course_number');
    expect(query.limit).toBe(5);
    expect(query.include).toEqual(['sections']);
  });

  it('rejects an unsupported entity (table not in registry)', () => {
    expect(() => validateAssistantQuery({ entity: 'drop_table', limit: 10 }, USER)).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_ENTITY' }),
    );
    expect(() => validateAssistantQuery({ entity: 'users_passwords ' }, USER)).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_ENTITY' }),
    );
  });

  it('rejects non-exposed columns (no wildcard, no private columns)', () => {
    expect(() =>
      validateAssistantQuery({ entity: 'users', select: ['password_hash'], limit: 5 }, USER),
    ).toThrowError('Column "password_hash" is not exposed');
    expect(() =>
      validateAssistantQuery({ entity: 'courses', select: ['*'], limit: 5 }, USER),
    ).toThrowError('is not exposed');
    expect(() =>
      validateAssistantQuery({ entity: 'users', select: ['email', 'first_name'], limit: 5 }, USER),
    ).toThrowError('"email" is not exposed');
  });

  it('rejects filters on columns that are not filterable', () => {
    expect(() =>
      validateAssistantQuery({ entity: 'sections', filters: [{ field: 'secret', operator: 'eq', value: 1 }] }, USER),
    ).toThrowError('not filterable');
  });

  it('rejects unsupported filter operators', () => {
    expect(() =>
      validateAssistantQuery(
        { entity: 'courses', filters: [{ field: 'subject', operator: 'execute', value: 'DROP' }] },
        USER,
      ),
    ).toThrowError('Unsupported filter operator');
  });

  it('only permits the defined read-only operator set', () => {
    expect(QUERY_OPERATORS).toEqual([
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
    ]);
    // No mutating or text-manipulation operators exist in the contract.
    for (const forbidden of ['update', 'delete', 'insert', 'select', 'raw']) {
      expect(QUERY_OPERATORS).not.toContain(forbidden);
    }
  });

  it('rejects unsupported relationships / includes', () => {
    expect(() =>
      validateAssistantQuery({ entity: 'courses', include: ['secret_table'], limit: 5 }, USER),
    ).toThrowError('Relationship "secret_table" is not supported');
  });

  it('clamps the limit to the bounded range', () => {
    const big = validateAssistantQuery({ entity: 'courses', limit: 999_999 }, USER);
    expect(big.limit).toBe(MAX_QUERY_LIMIT);

    const small = validateAssistantQuery({ entity: 'courses', limit: 0 }, USER);
    expect(small.limit).toBe(MIN_QUERY_LIMIT);

    // When no limit is given, the contract omits it and execution applies the default.
    const none = validateAssistantQuery({ entity: 'courses' }, USER);
    expect(none.limit).toBeUndefined();
    expect(DEFAULT_QUERY_LIMIT).toBe(20);
  });

  it('rejects aggregate stats on non-review entities', () => {
    expect(() =>
      validateAssistantQuery({ entity: 'courses', stats: { avg: ['rating'] }, limit: 5 }, USER),
    ).toThrowError('only supported for review entities');
  });

  it('accepts the LLM envelope { intent, query }', () => {
    const { intent, query } = parseGeneratedQuery(
      {
        intent: 'list courses',
        query: { entity: 'courses', limit: 3 },
      },
      USER,
    );
    expect(intent).toBe('list courses');
    expect(query.entity).toBe('courses');
  });

  it('rejects unknown/extra query fields (no SQL smuggling)', () => {
    for (const smuggled of [
      { entity: 'courses', sql: 'select * from courses; drop table courses;' },
      { entity: 'courses', operation: 'INSERT', limit: 1 },
      { entity: 'courses', query: 'select 1' },
      { entity: 'courses', table: 'users' },
    ]) {
      expect(() => validateAssistantQuery(smuggled, USER)).toThrowError('Unsupported query field');
    }
  });

  it('constrains text filter values and filter count', () => {
    expect(() =>
      validateAssistantQuery(
        { entity: 'courses', filters: [{ field: 'title', operator: 'ilike', value: 'a'.repeat(300) }] },
        USER,
      ),
    ).toThrowError('too long');

    const many = Array.from({ length: 30 }, (_, i) => ({
      field: 'id',
      operator: 'eq',
      value: i,
    }));
    expect(() => validateAssistantQuery({ entity: 'sections', filters: many }, USER)).toThrowError(
      'Too many filters',
    );
  });
});

describe('assistant query authorization scoping', () => {
  it('rejects queries that scope private data to another user', () => {
    expect(() =>
      validateAssistantQuery(
        { entity: 'schedules', filters: [{ field: 'user_id', operator: 'eq', value: OTHER_USER }], limit: 10 },
        USER,
      ),
    ).toThrowError(expect.objectContaining({ code: 'USER_SCOPE_VIOLATION' }));

    expect(() =>
      validateAssistantQuery(
        { entity: 'course_saves', filters: [{ field: 'user_id', operator: 'eq', value: OTHER_USER }] },
        USER,
      ),
    ).toThrowError(expect.objectContaining({ code: 'USER_SCOPE_VIOLATION' }));
  });

  it('allows scoping private data to the caller', () => {
    const query = validateAssistantQuery(
      {
        entity: 'schedules',
        select: ['id', 'name'],
        filters: [{ field: 'user_id', operator: 'eq', value: USER }],
        limit: 10,
      },
      USER,
    );
    expect(query.filters?.[0]?.value).toBe(USER);
  });

  it('rejects malformed query payloads with useful app errors', () => {
    expect(() => validateAssistantQuery('select * from courses', USER)).toThrowError(AppError);
    expect(() => validateAssistantQuery({}, USER)).toThrowError('missing an entity');
    expect(() => validateAssistantQuery({ entity: 42 }, USER)).toThrowError('missing an entity');
    expect(() =>
      validateAssistantQuery({ entity: 'courses', select: 'title' }, USER),
    ).toThrowError('"select" must be an array');
  });
});