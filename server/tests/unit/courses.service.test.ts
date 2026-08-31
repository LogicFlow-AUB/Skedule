import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import { listCourses } from '../../src/services/courses.service.js';

const COURSES: Row[] = [
  { id: 20, subject: 'ACCT', course_number: '210', title: 'Financial Accounting', credits: '3', department: 'Accounting', college: 'OSB', level: '200' },
  { id: 271, subject: 'BUSS', course_number: '211', title: 'Business Statistics', credits: '2', department: 'Business', college: 'OSB', level: '200' },
  { id: 999, subject: 'CMPS', course_number: '214', title: 'Data Structures', credits: '3', department: 'CS', college: 'FAS', level: '200' },
];

const SECTIONS: Row[] = [
  { term_id: 1, course_id: 20, seats_total: 30, seats_remaining: 5, professors: { id: 7, first_name: 'Rania', last_name: 'Nouiehed' } },
  { term_id: 1, course_id: 20, seats_total: 30, seats_remaining: 5, professors: { id: 9, first_name: 'Sami', last_name: 'Baroudi' } },
  { term_id: 5, course_id: 20, seats_total: 20, seats_remaining: 2, professors: { id: 9, first_name: 'Sami', last_name: 'Baroudi' } },
  { term_id: 1, course_id: 271, seats_total: 40, seats_remaining: 10, professors: null },
  { term_id: 2, course_id: 999, seats_total: 25, seats_remaining: 0, professors: { id: 3, first_name: 'Hassan', last_name: 'Artail' } },
];

const REVIEWS: Row[] = [
  { id: 1, course_id: 20, rating: 4, difficulty: 3, workload: 4, would_retake: true },
  { id: 2, course_id: 271, rating: 5, difficulty: 2, workload: 3, would_retake: true },
];

const COURSE_ATTRIBUTES: Row[] = [{ course_id: 20, attributes: { name: 'Writing' } }];

const PAGINATION = { page: 1, limit: 10, offset: 0 };

beforeEach(() => {
  fakeClient.value = createFakeSupabase({
    courses: COURSES,
    sections: SECTIONS,
    course_reviews: REVIEWS,
    course_attributes: COURSE_ATTRIBUTES,
  });
});

describe('courses.service listCourses professor attachment', () => {
  it('returns the full course set regardless of term (term-agnostic course list)', async () => {
    const page = await listCourses({
      sort: 'name',
      order: 'asc',
      pagination: PAGINATION,
    });
    expect(page.data.map((c) => c.code)).toEqual(['ACCT 210', 'BUSS 211', 'CMPS 214']);
  });

  it('does not attach professors when no term is given', async () => {
    const page = await listCourses({
      sort: 'name',
      order: 'asc',
      pagination: PAGINATION,
    });
    for (const course of page.data) {
      expect(course.professors).toBeUndefined();
    }
  });

  it('attaches only professors teaching in the selected term, deduplicated and sorted', async () => {
    const page = await listCourses({
      sort: 'name',
      order: 'asc',
      termId: 1,
      pagination: PAGINATION,
    });
    const accounting = page.data.find((c) => c.code === 'ACCT 210')!;
    expect(accounting.professors?.map((p) => p.last_name)).toEqual(['Baroudi', 'Nouiehed']);
  });

  it('leaves courses with no term section without professors', async () => {
    const page = await listCourses({
      sort: 'name',
      order: 'asc',
      termId: 1,
      pagination: PAGINATION,
    });
    const stats = page.data.find((c) => c.code === 'BUSS 211')!;
    const cs = page.data.find((c) => c.code === 'CMPS 214')!;
    expect(stats.professors).toEqual([]);
    expect(cs.professors).toEqual([]);
  });
});
