/**
 * Catalog lookups for the schedule optimizer UI.
 *
 * These endpoints feed the optimizer's dropdowns (planning terms, required
 * attributes) and its offered-course search (courses offered in a selected
 * term, with the professors teaching them). No scheduling / MILP logic lives
 * here: the actual optimization is handled by `schedule-optimizer.service.ts`.
 */

import { requireSupabaseClient } from '../db/supabase.js';
import { sortTermsNewestFirst } from './term-window.js';

type TermRow = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};
type AttributeRow = { id: number; name: string };

export type OptimizerTermOption = {
  id: number;
  name: string;
  code?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
};

export type OptimizerAttributeOption = { id: number; name: string };

export type OptimizerProfessorOption = { id: number; first_name: string; last_name: string };

export type OptimizerCourseOption = {
  id: number;
  code: string;
  title: string;
  credits: number;
  professors: OptimizerProfessorOption[];
};

type CourseNested = {
  id: number;
  subject: string;
  course_number: string;
  title: string;
  credits: string;
};

type ProfessorNested = { id: number; first_name: string; last_name: string };

/** A row from `sections` joined to its course and professor. */
type SectionLookupRow = {
  course_id: number | null;
  professors: ProfessorNested | ProfessorNested[] | null;
};

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function courseCode(course: CourseNested): string {
  return `${course.subject} ${course.course_number}`.trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Maps DB term rows to the optimizer options, newest-first, clubs/online excluded. */
function toTermOptions(rows: TermRow[]): OptimizerTermOption[] {
  return sortTermsNewestFirst(rows).map((term) => {
    const option: OptimizerTermOption = { id: term.id, name: term.name };
    if (term.code) option.code = term.code;
    if (term.description) option.description = term.description;
    if (term.start_date) option.start_date = term.start_date;
    if (term.end_date) option.end_date = term.end_date;
    return option;
  });
}

/** Returns the planning terms and required attributes for the optimizer UI. */
export async function listOptimizerOptions(): Promise<{
  terms: OptimizerTermOption[];
  attributes: OptimizerAttributeOption[];
}> {
  const db = requireSupabaseClient();
  const [termsResult, attributesResult] = await Promise.all([
    db.from('terms').select('id, name, code, description, start_date, end_date'),
    db.from('attributes').select('id, name'),
  ]);
  if (termsResult.error) throw termsResult.error;
  if (attributesResult.error) throw attributesResult.error;

  const terms = toTermOptions((termsResult.data ?? []) as TermRow[]);

  const attributes = ((attributesResult.data ?? []) as AttributeRow[]).map((attribute) => ({
    id: attribute.id,
    name: attribute.name,
  }));

  return { terms, attributes };
}

/**
 * Lists the available planning terms. The term selector uses the
 * human-readable `description` when present (falling back to the code), and
 * `code` is the stable external AUB identifier.
 */
export async function listTerms(): Promise<OptimizerTermOption[]> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('terms')
    .select('id, name, code, description, start_date, end_date');
  if (error) throw error;

  return toTermOptions((data ?? []) as TermRow[]);
}

/**
 * Searches the courses offered in a single term (via `term_courses`), narrowed
 * by a free-text search on code, title, or number. Each course carries its own
 * credits from the `courses` table and the professors who teach it in that term
 * (gathered from that term's sections only).
 */
export async function searchOfferedCourses(
  termId: number | null,
  search?: string,
): Promise<OptimizerCourseOption[]> {
  const db = requireSupabaseClient();

  if (termId == null) return [];

  const { data: offering, error: offeringError } = await db
    .from('term_courses')
    .select('course_id')
    .eq('term_id', termId);
  if (offeringError) throw offeringError;

  const offeredIds = ((offering ?? []) as Array<{ course_id: number }>).map(
    (row) => row.course_id,
  );
  if (offeredIds.length === 0) return [];

  let courseQuery = db
    .from('courses')
    .select('id, subject, course_number, title, credits')
    .in('id', offeredIds);

  const trimmed = search?.trim();
  if (trimmed) {
    const safe = trimmed.replace(/[(),]/g, '');
    courseQuery = courseQuery.or(
      `subject.ilike.%${safe}%,title.ilike.%${safe}%,course_number.ilike.%${safe}%`,
    );
  }

  const { data, error } = await courseQuery;
  if (error) throw error;

  const courses = (data ?? []) as CourseNested[];
  if (courses.length === 0) return [];

  const courseIds = courses.map((course) => course.id);

  const { data: sectionRows, error: sectionError } = await db
    .from('sections')
    .select('course_id, professors(id, first_name, last_name)')
    .eq('term_id', termId)
    .in('course_id', courseIds);
  if (sectionError) throw sectionError;

  const professorByCourse = new Map<number, OptimizerProfessorOption[]>();
  const seen = new Set<string>();
  for (const row of (sectionRows ?? []) as SectionLookupRow[]) {
    const professor = toOne(row.professors);
    if (!professor || row.course_id === null || row.course_id === undefined) continue;
    const key = `${row.course_id}:${professor.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = professorByCourse.get(row.course_id) ?? [];
    list.push({ id: professor.id, first_name: professor.first_name, last_name: professor.last_name });
    professorByCourse.set(row.course_id, list);
  }

  const result = courses.map((course) => {
    const credits = Number(course.credits);
    return {
      id: course.id,
      code: courseCode(course),
      title: course.title,
      credits: Number.isFinite(credits) ? credits : 0,
      professors: (professorByCourse.get(course.id) ?? []).sort((a, b) =>
        a.last_name.localeCompare(b.last_name),
      ),
    };
  });

  if (trimmed) {
    const needle = normalize(trimmed);
    result.sort((a, b) => {
      const aStarts = normalize(a.code).startsWith(needle) ? 0 : 1;
      const bStarts = normalize(b.code).startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.code.localeCompare(b.code);
    });
  } else {
    result.sort((a, b) => a.code.localeCompare(b.code));
  }

  return result;
}
