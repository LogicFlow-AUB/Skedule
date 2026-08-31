import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase, FakeQuery } from '../fixtures/fake-supabase.js';
import { executeAssistantQuery } from '../../src/services/assistant-database.js';
import type { Row } from '../fixtures/fake-supabase.js';

const { fakeClient } = vi.hoisted(() => {
  return { fakeClient: { value: null as unknown } };
});

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));

const USER = '5bdce3e1-b0e4-49e6-b4ca-7432bf8937c4';
const OTHER_USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function buildTables(): Record<string, Row[]> {
  return {
    courses: [
      { id: 1, subject: 'CMPS', course_number: '202', title: 'Data Structures', credits: '3', level: '300', college: 'CAS', department: 'CS' },
      { id: 2, subject: 'MATH', course_number: '201', title: 'Calculus III', credits: '3', level: '200', college: 'CAS', department: 'Math' },
    ],
    professors: [{ id: 10, first_name: 'Bassam', last_name: 'Shayya', department: 'CS', title: 'Professor' }],
    sections: [
      { id: 100, course_id: 1, professor_id: 10, term_id: 1, section_number: 'L1', crn: '10001', schedule_type: 'Lecture', campus: 'Beirut', room: 'A1', days: 'MWF', start_time: '10:00', end_time: '10:50', seats_total: 70, seats_remaining: 2, status: 'open', link_identifier: 'L1', meeting_schedule_type: 'L' },
    ],
    section_meetings: [
      { id: 900, section_id: 100, term_id: 1, monday: true, tuesday: false, wednesday: true, thursday: false, friday: true, saturday: false, sunday: false, start_time: '10:00', end_time: '10:50', building: 'Nicol', room: 'A1', meeting_type: 'Lecture' },
    ],
    course_reviews: [
      { id: 1, user_id: USER, course_id: 1, rating: 4, difficulty: 3, workload: 3, would_retake: true, comment: 'good', created_at: '2026-01-01' },
      { id: 2, user_id: OTHER_USER, course_id: 1, rating: 5, difficulty: 2, workload: 2, would_retake: true, comment: 'great', created_at: '2026-01-02' },
    ],
    schedules: [
      { id: 50, user_id: USER, term_id: 1, name: 'Fall', notes: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      { id: 51, user_id: OTHER_USER, term_id: 1, name: 'Other', notes: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
    ],
    schedule_sections: [
      { id: 1, schedule_id: 50, section_id: 100 },
      { id: 2, schedule_id: 51, section_id: 100 },
    ],
    course_saves: [
      { user_id: USER, course_id: 1, created_at: '2026-01-01' },
      { user_id: OTHER_USER, course_id: 1, created_at: '2026-01-02' },
    ],
    friendships: [
      { id: 1, user_id: USER, friend_id: OTHER_USER, status: 'accepted', created_at: '2026-01-01' },
      { id: 2, user_id: 'cccccccc-dddd-eeee-ffff-000000000000', friend_id: USER, status: 'accepted', created_at: '2026-01-01' },
    ],
  };
}

function makeClient(tables: Record<string, Row[]>) {
  const inner = createFakeSupabase(tables);
  const queries: FakeQuery[] = [];
  const client = {
    from: (table: string) => {
      const query = inner.from(table);
      queries.push(query);
      return query;
    },
  };
  return { client, queries };
}

let queries: FakeQuery[];

beforeEach(() => {
  const { client, queries: recorded } = makeClient(buildTables());
  fakeClient.value = client;
  queries = recorded;
});

describe('assistant executor — relationships via backend-owned path', () => {
  it('embeds sections for a courses query', async () => {
    await executeAssistantQuery(
      { entity: 'courses', select: ['id', 'title'], include: ['sections'], limit: 3 },
      USER,
    );
    const q = queries.at(-1)!;
    expect(q.lastSelect).toContain('sections(');
    expect(q.lastSelect).toContain('professors(');
  });

  it('embeds professor and meetings for a sections query', async () => {
    const result = await executeAssistantQuery(
      { entity: 'sections', select: ['id', 'section_number'], include: ['professor', 'meetings'], limit: 5 },
      USER,
    );
    const q = queries.at(-1)!;
    expect(q.lastSelect).toContain('professors(');
    expect(q.lastSelect).toContain('section_meetings(');
    expect(result.rows.map((r) => r.crn)).toEqual(['10001']);
  });
});

describe('assistant executor — limits', () => {
  it('applies the requested bounded limit', async () => {
    await executeAssistantQuery({ entity: 'courses', limit: 7 }, USER);
    expect(queries.at(-1)?.appliedLimit).toBe(7);
  });

  it('applies the default limit when none is given', async () => {
    await executeAssistantQuery({ entity: 'courses' }, USER);
    expect(queries.at(-1)?.appliedLimit).toBe(20);
  });
});

describe('assistant executor — private data authorization', () => {
  it('auto-scopes schedules to the authenticated user', async () => {
    const result = await executeAssistantQuery({ entity: 'schedules', select: ['id', 'name'], limit: 10 }, USER);
    expect(result.rows.map((r) => r.id)).toEqual([50]);
    const q = queries.at(-1)!;
    expect(q.filters()).toContainEqual({ field: 'user_id', operator: 'eq', value: USER });
  });

  it('auto-scopes schedule_sections through the user-owned schedules', async () => {
    const result = await executeAssistantQuery({ entity: 'schedule_sections', limit: 10 }, USER);
    expect(result.rows.map((r) => r.id)).toEqual([1]);
    const q = queries.find((query) => query.filters().some((f) => f.field === 'schedule_id'));
    expect(q?.filters()).toContainEqual({ field: 'schedule_id', operator: 'in', value: [50] });
  });

  it('auto-scopes course_saves to the authenticated user', async () => {
    const result = await executeAssistantQuery({ entity: 'course_saves', limit: 10 }, USER);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.user_id).toBe(USER);
  });

  it('scopes friendships to either side of the relationship', async () => {
    const result = await executeAssistantQuery({ entity: 'friendships', limit: 10 }, USER);
    expect(result.rows).toHaveLength(2);
    const q = queries.at(-1)!;
    expect(q.filters()).toContainEqual({
      field: 'or',
      operator: 'or',
      value: `user_id.eq.${USER},friend_id.eq.${USER}`,
    });
  });
});

describe('assistant executor — aggregates', () => {
  it('computes bounded aggregates for a single course', async () => {
    const result = await executeAssistantQuery(
      {
        entity: 'course_reviews',
        select: ['rating'],
        filters: [{ field: 'course_id', operator: 'eq', value: 1 }],
        stats: { avg: ['rating'] },
        limit: 50,
      },
      USER,
    );
    expect(result.stats?.count).toBe(2);
    expect(result.stats?.avgRating).toBe(4.5);
    expect(result.rows).toHaveLength(2);
  });

  it('requires an FK scoping filter for aggregates', async () => {
    await expect(
      executeAssistantQuery(
        { entity: 'course_reviews', select: ['rating'], stats: { avg: ['rating'] }, limit: 50 },
        USER,
      ),
    ).rejects.toThrowError('must filter by course_id');
  });
});

describe('assistant executor — defense in depth', () => {
  it('rejects unknown relationships even when called directly', async () => {
    await expect(
      executeAssistantQuery({ entity: 'courses', include: ['password_file'], limit: 5 }, USER),
    ).rejects.toThrowError('no "password_file" relationship');
  });

  it('treats filter values literally (no SQL interpretation)', async () => {
    await executeAssistantQuery(
      {
        entity: 'courses',
        filters: [{ field: 'subject', operator: 'ilike', value: `CMPS'; DROP TABLE courses;--` }],
        limit: 5,
      },
      USER,
    );
    const q = queries.at(-1)!;
    const applied = q.filters().find((f) => f.operator === 'ilike');
    expect(applied?.value).toBe(`%CMPS'; DROP TABLE courses;--%`);
  });

  it('does not leak rows beyond the requested limit', async () => {
    const result = await executeAssistantQuery({ entity: 'courses', limit: 1 }, USER);
    expect(result.rows).toHaveLength(1);
    expect(queries.at(-1)?.appliedLimit).toBe(1);
  });
});