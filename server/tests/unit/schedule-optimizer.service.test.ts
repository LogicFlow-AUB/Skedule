import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeSupabase } from '../fixtures/fake-supabase.js';
import { optimizeSchedule } from '../../src/services/schedule-optimizer.service.js';
import { AppError } from '../../src/utils/app-error.js';

const { fakeClient, fetchMock } = vi.hoisted(() => {
  return {
    fakeClient: { value: null as unknown },
    fetchMock: { value: null as unknown },
  };
});

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));

vi.mock('../../src/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config.js')>();
  return {
    default: {
      ...actual.default,
      scheduleOptimizer: { url: 'http://optimizer.test:8001' },
    },
  };
});

function courseRow(id: number, subject: string, number: string, credits: string, title: string) {
  return { id, subject, course_number: number, credits, title, level: null, college: null, department: null };
}

function buildSectionRow(options: {
  id: number;
  courseId: number;
  professorId?: number | null;
  scheduleType?: string | null;
  linkIdentifier?: string | null;
  status?: string | null;
  meetings?: Array<Record<string, unknown>>;
  professor?: Record<string, unknown> | null;
}) {
  const {
    id,
    courseId,
    professorId = null,
    scheduleType = 'Lecture',
    linkIdentifier = null,
    status = 'Open',
    meetings = [],
    professor = null,
  } = options;
  const course = courseRow(courseId, 'INDE', '402', '3', 'Operations Research');
  return {
    id,
    course_id: courseId,
    term_id: 1,
    professor_id: professorId,
    section_number: '1',
    crn: String(id),
    schedule_type: scheduleType,
    campus: 'Main Campus',
    seats_remaining: 10,
    status,
    room: '204',
    link_identifier: linkIdentifier,
    meeting_schedule_type: null,
    courses: course,
    professors: professor,
    section_meetings: meetings,
  };
}

function meeting(
  day: string,
  start: string,
  end: string,
  building = 'Nicely',
  room = '204',
  meetingType = 'Lecture',
) {
  const base: Record<string, boolean | string | null> = {
    id: Math.floor(Math.random() * 100000),
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false,
    start_time: start,
    end_time: end,
    building,
    room,
    meeting_type: meetingType,
  };
  base[`${day}` === 'M' ? 'monday' : day === 'T' ? 'tuesday' : day === 'W' ? 'wednesday' : day === 'R' ? 'thursday' : 'friday'] =
    true;
  return base;
}

const tables = {
  courses: [
    courseRow(101, 'INDE', '402', '3', 'Operations Research'),
    courseRow(118, 'MATH', '201', '3', 'Calculus III'),
    courseRow(143, 'ENGL', '204', '3', 'Technical Writing'),
    courseRow(207, 'MUSI', '269', '3', 'Music Appreciation'),
  ],
  course_attributes: [
    { course_id: 101, attribute_id: 12 },
    { course_id: 207, attribute_id: 12 },
  ],
  sections: [
    buildSectionRow({
      id: 501,
      courseId: 101,
      professorId: 45,
      professor: { id: 45, first_name: 'Maher', last_name: 'Nouiehed' },
      meetings: [
        meeting('M', '10:00', '10:50'),
        meeting('W', '10:00', '10:50'),
      ],
    }),
    buildSectionRow({
      id: 502,
      courseId: 118,
      professorId: 46,
      professor: { id: 46, first_name: 'Bassam', last_name: 'Shayya' },
      meetings: [meeting('T', '11:00', '11:50')],
    }),
    buildSectionRow({
      id: 503,
      courseId: 143,
      professorId: null,
      professor: null,
      meetings: [],
    }),
    buildSectionRow({
      id: 504,
      courseId: 207,
      professorId: null,
      scheduleType: 'Lecture',
      meetings: [meeting('F', '09:00', '09:50')],
    }),
  ],
  professors: [],
  section_meetings: [],
};

beforeEach(() => {
  fakeClient.value = createFakeSupabase(tables);
  fetchMock.value = null;
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (fetchMock.value) return fetchMock.value;
    return new Response(JSON.stringify({ status: 'optimal' }), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function okOptimizerResult() {
  return JSON.stringify({
    status: 'optimal',
    request_id: 'req-9',
    selected_course_ids: ['101', '118'],
    selected_section_ids: ['bundle::501', '502'],
    selected_section_component_ids: { 'bundle::501': ['501'], '502': ['502'] },
    selected_courses: [],
    selected_sections: [],
    total_credits: 6,
    campus_days: 2,
    weekly_largest_gaps_sum_minutes: 0,
    weekly_first_to_last_spans_sum_minutes: 0,
    professor_preference_penalty: 0,
    days: {},
    message: null,
    diagnostics: {},
  });
}

describe('schedule-optimizer.service', () => {
  it('expands the user request into a complete optimizer payload and POSTs it', async () => {
    fetchMock.value = new Response(okOptimizerResult(), { status: 200 });

    const result = await optimizeSchedule({
      request_id: 'req-9',
      term_id: 1,
      required_course_ids: [101, 118],
      acceptable_elective_course_ids: [143],
      attribute_ids: [12],
      min_credits: 6,
      max_credits: 6,
      weights: { days: 35, gaps: 40, professor: 25 },
      professor_preferences: { '45': 5, '46': 2 },
      excluded_section_ids: [503],
    });

    expect(result.status).toBe('optimal');
    expect(result.request_id).toBe('req-9');

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(fetchCall[0]).toBe('http://optimizer.test:8001/schedule-optimize');
    const payload = JSON.parse(String(fetchCall[1]!.body)) as Record<string, unknown>;

    // Courses carry required/elective status and real credits/codes.
    const courseIds = (payload.courses as Array<{ id: number; required: boolean }>).map((c) => ({
      id: c.id,
      required: c.required,
    }));
    expect(courseIds).toContainEqual({ id: 101, required: true });
    expect(courseIds).toContainEqual({ id: 118, required: true });
    expect(courseIds).toContainEqual({ id: 143, required: false });

    // Attribute 12 -> requirement group over requested courses carrying it.
    // 101 has the attribute; 207 also does but was not in the requested
    // course list, so it is excluded from the candidate set.
    const groups = payload.requirement_groups as Array<Record<string, unknown>>;
    expect(groups).toHaveLength(1);
    expect(groups[0]!.course_ids).toEqual([101]);
    expect(groups[0]!.min).toBe(1);

    // Excluded section id is passed as an excluded CRN (hard constraint).
    expect(payload.excluded_crn_ids).toEqual([503]);

    // Professor preferences are passed per-section as scores (soft).
    const sections = payload.sections as Array<Record<string, unknown>>;
    const prof45 = sections.find((s) => s.professor_id === 45);
    expect(prof45!.professor_score).toBe(5);
  });

  it('derives every meeting day from section_meetings day booleans', async () => {
    fetchMock.value = new Response(okOptimizerResult(), { status: 200 });

    await optimizeSchedule({
      term_id: 1,
      required_course_ids: [101],
      acceptable_elective_course_ids: [],
      min_credits: 3,
      max_credits: 3,
      weights: { days: 35, gaps: 40, professor: 25 },
    });

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const payload = JSON.parse(String(fetchCall[1]!.body)) as Record<string, unknown>;
    const section = (payload.sections as Array<Record<string, unknown>>)[0]!;
    const days = (section.meetings as Array<{ day: string }>).map((m) => m.day);
    expect(days).toEqual(['M', 'W']);
  });

  it('rejects a course that is both required and elective', async () => {
    await expect(
      optimizeSchedule({
        term_id: 1,
        required_course_ids: [101],
        acceptable_elective_course_ids: [101],
        min_credits: 3,
        max_credits: 6,
        weights: { days: 35, gaps: 40, professor: 25 },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects weights that do not total 100', async () => {
    await expect(
      optimizeSchedule({
        term_id: 1,
        required_course_ids: [101],
        acceptable_elective_course_ids: [],
        min_credits: 3,
        max_credits: 6,
        weights: { days: 30, gaps: 30, professor: 30 },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects min_credits greater than max_credits', async () => {
    await expect(
      optimizeSchedule({
        term_id: 1,
        required_course_ids: [101],
        acceptable_elective_course_ids: [],
        min_credits: 8,
        max_credits: 3,
        weights: { days: 35, gaps: 40, professor: 25 },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('throws a typed error when the optimizer URL is unreachable', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(
      optimizeSchedule({
        term_id: 1,
        required_course_ids: [101],
        acceptable_elective_course_ids: [],
        min_credits: 3,
        max_credits: 3,
        weights: { days: 35, gaps: 40, professor: 25 },
      }),
    ).rejects.toMatchObject({ code: 'OPTIMIZER_UNREACHABLE' });
  });

  it('forwards an infeasible result with HTTP 200 semantics', async () => {
    fetchMock.value = new Response(
      JSON.stringify({
        status: 'infeasible',
        selected_course_ids: [],
        selected_section_ids: [],
        selected_section_component_ids: {},
        selected_courses: [],
        selected_sections: [],
        message: 'No feasible schedule was found.',
        diagnostics: {},
      }),
      { status: 200 },
    );

    const result = await optimizeSchedule({
      term_id: 1,
      required_course_ids: [101],
      acceptable_elective_course_ids: [],
      min_credits: 6,
      max_credits: 6,
      weights: { days: 35, gaps: 40, professor: 25 },
    });

    expect(result.status).toBe('infeasible');
  });
});
