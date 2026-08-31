/**
 * Schedule-optimizer orchestration (Node side).
 *
 * Responsibility: receive a user-level schedule request, validate it, query
 * Supabase for the supporting catalog data, expand it into the exact optimizer
 * payload the FastAPI service expects, POST that payload to the optimizer
 * service, and return the structured result.
 *
 * FastAPI never touches the database; all database access lives here.
 */

import config from '../config.js';
import { requireSupabaseClient } from '../db/supabase.js';
import type { Course, Professor } from '../db/types.js';
import { AppError } from '../utils/app-error.js';

// ── Public types ────────────────────────────────────────────────────────────

export type OptimizeWeights = { days: number; gaps: number; professor: number };

export type OptimizeRequestInput = {
  request_id?: string;
  term_id: number;
  required_course_ids: number[];
  acceptable_elective_course_ids: number[];
  attribute_ids?: number[];
  min_credits: number;
  max_credits: number;
  weights: OptimizeWeights;
  professor_preferences?: Record<string, number>;
  excluded_section_ids?: number[];
  max_occurrences_per_day?: number;
};

export type OptimizerResult = {
  status: string;
  request_id?: string | null;
  selected_course_ids: string[];
  selected_section_ids: string[];
  selected_section_component_ids: Record<string, string[]>;
  selected_courses: Record<string, unknown>[];
  selected_sections: Record<string, unknown>[];
  total_credits: number;
  campus_days: number;
  weekly_largest_gaps_sum_minutes: number;
  weekly_first_to_last_spans_sum_minutes: number;
  professor_preference_penalty: number;
  days: Record<string, unknown>;
  message: string | null;
  diagnostics: Record<string, unknown>;
};

// ── Row shapes from Supabase ────────────────────────────────────────────────

type MeetingRow = {
  id: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_time: string | null;
  end_time: string | null;
  building: string | null;
  room: string | null;
  meeting_type: string | null;
};

type SectionWithRelations = {
  id: number;
  course_id: number | null;
  term_id: number | null;
  professor_id: number | null;
  section_number: string;
  crn: string;
  schedule_type: string | null;
  campus: string | null;
  seats_remaining: number | null;
  status: string | null;
  room: string | null;
  link_identifier: string | null;
  meeting_schedule_type: string | null;
  courses: Course | Course[] | null;
  professors: Professor | Professor[] | null;
  section_meetings: MeetingRow | MeetingRow[] | null;
};

type CourseAttributeRow = { course_id: number; attribute_id: number };

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const DAY_CODE: Record<string, string> = {
  monday: 'M',
  tuesday: 'T',
  wednesday: 'W',
  thursday: 'R',
  friday: 'F',
  saturday: 'S',
  sunday: 'U',
};

function timeToHHMM(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match?.[1] || !match[2]) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** Estimate a course code like "INDE 402" from subject + course_number. */
function courseCode(course: Course): string {
  return `${course.subject} ${course.course_number}`.trim();
}

function sectionMeetingsToOptimizer(section: SectionWithRelations): Array<Record<string, unknown>> {
  const raw = section.section_meetings;
  const rows: MeetingRow[] = Array.isArray(raw)
    ? raw.filter((m): m is MeetingRow => m !== null)
    : raw
      ? [raw]
      : [];

  const meetings: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const start = timeToHHMM(row.start_time);
    const end = timeToHHMM(row.end_time);
    if (!start || !end) continue;
    for (const [field, code] of Object.entries(DAY_CODE)) {
      if (row[field as keyof MeetingRow]) {
        meetings.push({
          day: code,
          start,
          end,
          building: row.building,
          room: row.room,
          meeting_type: row.meeting_type,
          meeting_id: row.id,
        });
      }
    }
  }
  return meetings;
}

/** Derive the optimizer component type from the AUB schedule type string. */
function componentTypeFromSchedule(scheduleType: string | null): string {
  const type = (scheduleType ?? '').toLowerCase();
  if (type.includes('lecture')) return 'lecture';
  if (type.includes('recit')) return 'recitation';
  if (type.includes('laboratory') || type.includes('lab')) return 'lab';
  if (type.includes('studio')) return 'lab';
  return 'lecture';
}

function sectionAvailability(section: SectionWithRelations): boolean {
  const status = (section.status ?? '').toLowerCase();
  // Any status other than an explicit close is treated as registerable.
  return status !== 'closed';
}

// ── Component bundling ──────────────────────────────────────────────────────

/**
 * Build the optimizer section list from DB sections, translating the AUB
 * ``link_identifier``/``schedule_type`` component model into the optimizer's
 * ``component_type`` + ``linked_section_ids``/``linked_option_groups`` bundle
 * structure. Lecture + recitation, lecture + lab, and lecture + recitation +
 * lab (two linked option groups) are all supported by the existing optimizer
 * and are expanded into selectable bundles.
 */
function buildSectionRecords(
  sections: SectionWithRelations[],
  preferences: Record<string, number>,
): Array<Record<string, unknown>> {
  const records = sections.map((section) => {
    const course = toOne(section.courses);
    const professor = toOne(section.professors);
    const professorId = section.professor_id ?? professor?.id ?? null;
    return {
      id: section.id,
      course_id: section.course_id ?? course?.id ?? section.id,
      crn: section.crn,
      section_number: section.section_number,
      course_code: course ? courseCode(course) : null,
      course_title: course?.title ?? null,
      credits: course ? Number(course.credits) || 0 : 0,
      component_type: componentTypeFromSchedule(section.schedule_type),
      schedule_type: section.schedule_type,
      link_identifier: section.link_identifier,
      campus: section.campus,
      room: section.room,
      professor: professor
        ? { id: professor.id, first_name: professor.first_name, last_name: professor.last_name }
        : null,
      professor_id: professorId,
      professor_score: professorId !== null ? (preferences[String(professorId)] ?? 0) : 0,
      available: sectionAvailability(section),
      major_eligible: true,
      otherwise_eligible: true,
      meetings: sectionMeetingsToOptimizer(section),
    };
  });

  // Group linked sections by (course_id, link_identifier).
  const linkedGroups = new Map<string, Array<Record<string, unknown>>>();
  for (const record of records) {
    if (!record.link_identifier) continue;
    const key = `${String(record.course_id)}::${String(record.link_identifier)}`;
    const group = linkedGroups.get(key) ?? [];
    group.push(record);
    linkedGroups.set(key, group);
  }

  const byId = new Map<string, Record<string, unknown>>();
  for (const record of records) byId.set(String(record.id), record);

  for (const [key, group] of linkedGroups) {
    if (group.length < 2) continue;
    const lecture = group.find((r) => r.component_type === 'lecture');
    const recitations = group.filter((r) => r.component_type === 'recitation');
    const labs = group.filter((r) => r.component_type === 'lab');
    if (!lecture) continue;

    const groups: Array<Record<string, unknown>> = [];
    if (recitations.length) {
      groups.push({ section_ids: recitations.map((r) => r.id) });
    }
    if (labs.length) {
      groups.push({ section_ids: labs.map((r) => r.id) });
    }

    if (groups.length === 1) {
      lecture.linked_section_ids = groups[0]!.section_ids;
    } else if (groups.length >= 2) {
      lecture.linked_option_groups = groups;
    }
    delete lecture.link_identifier;
    // NOTE: recitation/lab records remain in the list. The MILP's bundle
    // expansion links them to the lecture and excludes them from direct
    // selection itself; removing them here would make the links unresolvable
    // ("links unknown sections").
    void key;
  }

  return records;
}

// ── Validation ──────────────────────────────────────────────────────────────

function normalizeIdList(value: number[] | undefined, label: string): number[] {
  if (value === undefined) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', `${label} must be nonempty positive integers.`);
    }
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function validateRequest(input: OptimizeRequestInput): void {
  if (!Number.isInteger(input.term_id) || input.term_id <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'term_id must be a positive integer.');
  }
  if (typeof input.min_credits !== 'number' || input.min_credits < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'min_credits must be nonnegative.');
  }
  if (typeof input.max_credits !== 'number' || input.max_credits < 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'max_credits must be nonnegative.');
  }
  if (input.min_credits > input.max_credits) {
    throw new AppError(400, 'VALIDATION_ERROR', 'min_credits cannot exceed max_credits.');
  }

  const { days = 0, gaps = 0, professor = 0 } = input.weights;
  for (const [key, value] of Object.entries({ days, gaps, professor })) {
    if (typeof value !== 'number' || value < 0) {
      throw new AppError(400, 'VALIDATION_ERROR', `weight "${key}" must be nonnegative.`);
    }
  }
  if (Math.abs(days + gaps + professor - 100) > 1e-6) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The days, gaps, and professor weights must total 100.');
  }

  if (input.professor_preferences) {
    for (const [id, value] of Object.entries(input.professor_preferences)) {
      if (!/^\d+$/.test(id)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Professor preference keys must be professor IDs.');
      }
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Professor preference values must be nonnegative.');
      }
    }
  }

  const required = new Set(input.required_course_ids);
  const elective = new Set(input.acceptable_elective_course_ids);
  for (const id of required) {
    if (elective.has(id)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'A course cannot be both required and elective.');
    }
  }
}

// ── Supabase queries ────────────────────────────────────────────────────────

const SECTION_SELECT =
  'id, course_id, term_id, professor_id, section_number, crn, schedule_type, campus, seats_remaining, status, room, link_identifier, meeting_schedule_type, courses(id, subject, course_number, credits, title), professors(id, first_name, last_name), section_meetings(id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type)';

async function queryCourses(ids: number[]): Promise<Course[]> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('courses')
    .select('id, title, subject, course_number, credits, level, college, department')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as Course[];
}

async function queryCourseAttributes(attributeIds: number[]): Promise<CourseAttributeRow[]> {
  if (attributeIds.length === 0) return [];
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('course_attributes')
    .select('course_id, attribute_id')
    .in('attribute_id', attributeIds);
  if (error) throw error;
  return (data ?? []) as CourseAttributeRow[];
}

async function querySections(termId: number, courseIds: number[]): Promise<SectionWithRelations[]> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('sections')
    .select(SECTION_SELECT)
    .eq('term_id', termId)
    .in('course_id', courseIds);
  if (error) throw error;
  return (data ?? []) as SectionWithRelations[];
}

// ── Payload expansion ───────────────────────────────────────────────────────

function buildCourses(
  requiredIds: number[],
  electiveIds: number[],
  courseRows: Course[],
): Array<Record<string, unknown>> {
  const byId = new Map(courseRows.map((c) => [c.id, c]));
  const required = new Set(requiredIds);
  const outputs: Array<Record<string, unknown>> = [];
  for (const id of [...requiredIds, ...electiveIds]) {
    const course = byId.get(id);
    if (!course) {
      throw new AppError(404, 'COURSE_NOT_FOUND', `Course ${id} was not found.`);
    }
    outputs.push({
      id,
      credits: Number(course.credits) || 0,
      required: required.has(id),
      course_code: courseCode(course),
      course_title: course.title,
    });
  }
  return outputs;
}

/**
 * Build the attribute requirement groups. Each required attribute becomes a
 * hard rule that at least one selected course carries that attribute.
 */
function buildRequirementGroups(
  attributeIds: number[],
  courseAttributeRows: CourseAttributeRow[],
  candidateIds: Map<number, number>,
): Array<Record<string, unknown>> {
  const groups: Array<Record<string, unknown>> = [];
  for (const attributeId of attributeIds) {
    const courseIds = courseAttributeRows
      .filter((row) => row.attribute_id === attributeId)
      .map((row) => candidateIds.get(row.course_id))
      .filter((id): id is number => id !== undefined);
    if (courseIds.length === 0) {
      throw new AppError(
        422,
        'ATTRIBUTE_UNSATISFIABLE',
        `No requested course satisfies attribute ${attributeId}.`,
      );
    }
    groups.push({ course_ids: courseIds, min: 1, max: courseIds.length });
  }
  return groups;
}

// ── FastAPI client ──────────────────────────────────────────────────────────

async function callOptimizer(payload: Record<string, unknown>): Promise<OptimizerResult> {
  const url = config.scheduleOptimizer.url;
  if (!url) {
    throw new AppError(
      503,
      'OPTIMIZER_UNAVAILABLE',
      'SCHEDULE_OPTIMIZER_URL is not configured.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url}/schedule-optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new AppError(
      502,
      'OPTIMIZER_UNREACHABLE',
      `The optimizer service could not be reached: ${(error as Error).message}`,
    );
  }

  if (response.status === 422) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new AppError(
      422,
      'INVALID_OPTIMIZER_INPUT',
      body?.message ?? 'The optimizer rejected the expanded request.',
    );
  }

  if (!response.ok) {
    throw new AppError(502, 'OPTIMIZER_ERROR', `The optimizer service returned ${response.status}.`);
  }

  return (await response.json()) as OptimizerResult;
}

// ── Orchestration ───────────────────────────────────────────────────────────

export async function optimizeSchedule(
  input: OptimizeRequestInput,
): Promise<OptimizerResult> {
  validateRequest(input);

  const requiredIds = normalizeIdList(input.required_course_ids, 'required_course_ids');
  const electiveIds = normalizeIdList(input.acceptable_elective_course_ids, 'acceptable_elective_course_ids');
  const attributeIds = normalizeIdList(input.attribute_ids, 'attribute_ids');
  const excludedSectionIds = normalizeIdList(input.excluded_section_ids, 'excluded_section_ids');

  if (requiredIds.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one required course is required.');
  }

  const courseIds = [...new Set([...requiredIds, ...electiveIds])];
  const [courseRows, attributeRows, sectionRows] = await Promise.all([
    queryCourses(courseIds),
    queryCourseAttributes(attributeIds),
    querySections(input.term_id, courseIds),
  ]);

  const candidateIds = new Map<number, number>();
  for (const course of courseRows) candidateIds.set(course.id, course.id);

  const sections = buildSectionRecords(sectionRows, input.professor_preferences ?? {});

  const requirementGroups = buildRequirementGroups(
    attributeIds,
    attributeRows,
    candidateIds,
  );

  const payload: Record<string, unknown> = {
    request_id: input.request_id,
    courses: buildCourses(requiredIds, electiveIds, courseRows),
    sections,
    min_credits: input.min_credits,
    max_credits: input.max_credits,
    weights: input.weights,
    requirement_groups: requirementGroups,
    excluded_crn_ids: excludedSectionIds,
  };
  if (input.max_occurrences_per_day !== undefined) {
    payload.max_occurrences_per_day = input.max_occurrences_per_day;
  }

  return callOptimizer(payload);
}
