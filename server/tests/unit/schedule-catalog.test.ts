import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import {
  listOptimizerOptions,
  listTerms,
  searchOfferedCourses,
} from '../../src/services/schedule-catalog.service.js';
import { termsInSyncWindow } from '../../src/services/term-window.js';

const TERMS: Row[] = [
  { id: 1, name: '202710', code: '202710', description: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-20' },
  { id: 2, name: '202720', code: '202720', description: 'Spring 2027', start_date: null, end_date: null },
  { id: 3, name: 'legacy', code: null, description: null, start_date: null, end_date: null },
];

const ATTRIBUTES: Row[] = [
  { id: 5, name: 'Writing' },
  { id: 8, name: 'Quantitative Thought' },
];

const COURSES: Row[] = [
  { id: 20, subject: 'ACCT', course_number: '210', title: 'Financial Accounting', credits: '3' },
  { id: 271, subject: 'BUSS', course_number: '211', title: 'Business Statistics', credits: '2' },
  { id: 999, subject: 'CMPS', course_number: '214', title: 'Data Structures', credits: '3' },
  { id: 123, subject: 'MATH', course_number: '201', title: 'Calculus I', credits: '3.00' },
];

// Which courses are offered in each term.
const TERM_COURSES: Row[] = [
  { term_id: 1, course_id: 20 },
  { term_id: 1, course_id: 271 },
  { term_id: 2, course_id: 999 },
  { term_id: 2, course_id: 123 },
];

const SECTIONS: Row[] = [
  { term_id: 1, course_id: 20, professors: { id: 7, first_name: 'Rania', last_name: 'Nouiehed' } },
  { term_id: 1, course_id: 20, professors: { id: 9, first_name: 'Sami', last_name: 'Baroudi' } },
  { term_id: 5, course_id: 20, professors: { id: 9, first_name: 'Sami', last_name: 'Baroudi' } },
  { term_id: 1, course_id: 271, professors: { id: 7, first_name: 'Rania', last_name: 'Nouiehed' } },
  { term_id: 1, course_id: 271, professors: null },
  { term_id: 2, course_id: 999, professors: { id: 3, first_name: 'Hassan', last_name: 'Artail' } },
  { term_id: 2, course_id: 123, professors: { id: 3, first_name: 'Hassan', last_name: 'Artail' } },
];

beforeEach(() => {
  fakeClient.value = createFakeSupabase({
    terms: TERMS,
    attributes: ATTRIBUTES,
    courses: COURSES,
    sections: SECTIONS,
    term_courses: TERM_COURSES,
  });
});

describe('schedule-catalog.service', () => {
  describe('listOptimizerOptions', () => {
    it('returns terms (code + description when present) and attributes', async () => {
      const { terms, attributes } = await listOptimizerOptions();
      expect(terms).toEqual([
        { id: 2, name: '202720', code: '202720', description: 'Spring 2027' },
        { id: 1, name: '202710', code: '202710', description: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-20' },
        { id: 3, name: 'legacy' },
      ]);
      expect(attributes).toEqual([
        { id: 5, name: 'Writing' },
        { id: 8, name: 'Quantitative Thought' },
      ]);
    });
  });

  describe('listTerms', () => {
    it('lists terms sorted newest-first by code, limited to the sync window', async () => {
      const terms = await listTerms();
      expect(terms).toEqual([
        { id: 2, name: '202720', code: '202720', description: 'Spring 2027' },
        { id: 1, name: '202710', code: '202710', description: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-20' },
        { id: 3, name: 'legacy' },
      ]);
    });
  });

  describe('searchOfferedCourses', () => {
    it('returns only courses offered in the selected term, with correct credits', async () => {
      const courses = await searchOfferedCourses(1);
      expect(courses.map((c) => c.code)).toEqual(['ACCT 210', 'BUSS 211']);
      const accounting = courses.find((c) => c.code === 'ACCT 210')!;
      expect(accounting.credits).toBe(3);
      expect(accounting.title).toBe('Financial Accounting');
    });

    it('returns nothing for a term with no offered courses', async () => {
      const courses = await searchOfferedCourses(null);
      expect(courses).toEqual([]);
    });

    it('attaches each course its professors who teach it in that term, deduplicated', async () => {
      const courses = await searchOfferedCourses(1);
      const accounting = courses.find((c) => c.code === 'ACCT 210')!;
      expect(accounting.professors.map((p) => p.last_name)).toEqual(['Baroudi', 'Nouiehed']);
      const stats = courses.find((c) => c.code === 'BUSS 211')!;
      expect(stats.professors.map((p) => p.first_name)).toEqual(['Rania']);
    });

    it('gathers professors only from the selected term', async () => {
      const courses = await searchOfferedCourses(2);
      const dataStructures = courses.find((c) => c.code === 'CMPS 214')!;
      expect(dataStructures.professors.map((p) => p.last_name)).toEqual(['Artail']);
      const calculus = courses.find((c) => c.code === 'MATH 201')!;
      expect(calculus.credits).toBe(3);
    });

    it('filters by a free-text search within the offered term', async () => {
      const courses = await searchOfferedCourses(1, 'accounting');
      expect(courses.map((c) => c.code)).toEqual(['ACCT 210']);
      const none = await searchOfferedCourses(1, 'calculus');
      expect(none.map((c) => c.code)).toEqual([]);
    });

    it('sorts by course code when no search is given', async () => {
      const courses = await searchOfferedCourses(2);
      expect(courses.map((c) => c.code)).toEqual(['CMPS 214', 'MATH 201']);
    });
  });

  describe('termsInSyncWindow', () => {
    it('excludes Online semesters and keeps the academic terms newest first', () => {
      const terms = [
        { code: '202620', description: 'Spring' },
        { code: '202630', description: 'Summer' },
        { code: '202671', description: 'Online Fall 1' },
        { code: '202672', description: 'Online Fall 2' },
        { code: '202673', description: 'Online Spring 1' },
        { code: '202710', description: 'Fall 2026-2027 (View Only)' },
      ];
      expect(termsInSyncWindow(terms).map((t) => t.code)).toEqual([
        '202710',
        '202630',
        '202620',
      ]);
      expect(termsInSyncWindow(terms).some((t) => String(t.code).startsWith('20267'))).toBe(false);
    });

    it('keeps only the 5 most recent academic terms by numeric code, newest first', () => {
      const terms = [
        { code: '202620', description: 'Spring' },
        { code: '202630', description: 'Summer' },
        { code: '202610', description: 'Fall' },
        { code: '202650', description: 'Summer' },
        { code: '202640', description: 'Spring' },
        { code: '202710', description: 'Fall 2026-2027 (View Only)' },
      ];
      expect(termsInSyncWindow(terms).map((t) => t.code)).toEqual([
        '202710',
        '202650',
        '202640',
        '202630',
        '202620',
      ]);
    });

    it('excludes the Clubs term before selecting the window', () => {
      const terms = [
        { code: '202695', description: 'Clubs 2025-2026 (View Only)' },
        { code: '202620', description: 'Spring 2025-2026 (View Only)' },
        { code: '202710', description: 'Fall 2026-2027 (View Only)' },
      ];
      const windowed = termsInSyncWindow(terms);
      expect(windowed.some((t) => t.code === '202695')).toBe(false);
      expect(windowed.map((t) => t.code)).toEqual(['202710', '202620']);
    });
  });
});
