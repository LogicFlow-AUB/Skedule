import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import {
  listOptimizerOptions,
  listTerms,
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
