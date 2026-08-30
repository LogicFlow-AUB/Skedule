import { requireSupabaseClient } from '../db/supabase.js';
import type { Schedule } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { trackActivity } from './activity.service.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type CreateScheduleInput = {
  name: string;
  notes?: string;
  termId?: number;
  sectionIds?: number[];
  saved?: boolean;
};

export type UpdateScheduleInput = {
  name?: string;
  notes?: string | null;
};

/** Replaces the current draft for a (user, term) with the given sections. */
export type SaveDraftInput = {
  name?: string;
  notes?: string | null;
  sectionIds?: number[];
};

export type ScheduleCourse = {
  courseId: number | null;
  code: string | null;
  title: string | null;
  credits: number;
  section: {
    id: number;
    sectionNumber: string;
    room: string | null;
    days: number[];
    startTime: string | null;
    endTime: string | null;
    startMinutes: number | null;
    endMinutes: number | null;
    durationMinutes: number | null;
    seatsTotal: number | null;
    seatsRemaining: number | null;
    linkIdentifier: string | null;
    scheduleType: string | null;
    meetings: Array<{
      id: number;
      days: number[];
      startTime: string | null;
      endTime: string | null;
      startMinutes: number | null;
      endMinutes: number | null;
      durationMinutes: number | null;
      building: string | null;
      room: string | null;
      meetingType: string | null;
    }>;
  };
  professor: { id: number; firstName: string; lastName: string } | null;
};

export type ScheduleSummary = {
  id: number;
  name: string | null;
  notes: string | null;
  termId: number | null;
  saved: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  courseCount: number;
  totalCredits: number;
  days: number[];
};

export type ScheduleDetail = ScheduleSummary & {
  courses: ScheduleCourse[];
};

export type ScheduleConflict = {
  type: 'time';
  days: number[];
  message: string;
  sections: {
    sectionId: number;
    courseId: number | null;
    code: string | null;
    sectionNumber: string;
    startTime: string | null;
    endTime: string | null;
  }[];
};

type SectionCourseRow = {
  id: number;
  subject: string;
  course_number: string;
  title: string;
  credits: string;
};

type SectionProfessorRow = {
  id: number;
  first_name: string;
  last_name: string;
};

type SectionMeetingRow = {
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

type SectionRow = {
  id: number;
  course_id: number | null;
  professor_id: number | null;
  section_number: string;
  days: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  seats_total: number | null;
  seats_remaining: number | null;
  link_identifier: string | null;
  schedule_type: string | null;
  courses: SectionCourseRow | SectionCourseRow[] | null;
  professors: SectionProfessorRow | SectionProfessorRow[] | null;
  section_meetings: SectionMeetingRow | SectionMeetingRow[] | null;
};

type ScheduleSectionRow = {
  schedule_id: number;
  section_id: number;
  sections: SectionRow | SectionRow[] | null;
};

const SCHEDULE_COLUMNS =
  'id, user_id, name, notes, term_id, saved, is_favorite, created_at, updated_at';
const SECTION_COLUMNS =
  'id, course_id, professor_id, section_number, days, start_time, end_time, room, seats_total, seats_remaining, link_identifier, schedule_type, courses(id, subject, course_number, title, credits), professors(id, first_name, last_name), section_meetings(id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, building, room, meeting_type)';
const SCHEDULE_SECTION_COLUMNS = `schedule_id, section_id, sections(${SECTION_COLUMNS})`;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_CODES: Record<string, number> = { M: 0, T: 1, W: 2, R: 3, F: 4 };
const DAY_NAMES: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4 };

/**
 * PostgREST returns a to-one embed as an object, but a to-many embed as an
 * array. Normalises both shapes to a single row.
 */
function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/** Parses a meeting-day string such as `MWF`, `TR`, or `Mon/Wed` into day indexes. */
export function parseDays(days: string | null): number[] {
  if (!days) {
    return [];
  }

  const parsed = new Set<number>();

  for (const token of days
    .trim()
    .toUpperCase()
    .split(/[^A-Z]+/)) {
    if (!token) {
      continue;
    }

    const named = DAY_NAMES[token.slice(0, 3)];

    if (token.length >= 3 && named !== undefined) {
      parsed.add(named);
      continue;
    }

    for (const character of token) {
      const day = DAY_CODES[character];

      if (day !== undefined) {
        parsed.add(day);
      }
    }
  }

  return [...parsed].sort((first, second) => first - second);
}

export function parseMinutes(time: string | null): number | null {
  if (!time) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  const hours = match?.[1];
  const minutes = match?.[2];

  if (hours === undefined || minutes === undefined) {
    return null;
  }

  return Number(hours) * 60 + Number(minutes);
}

function formatDays(days: number[]): string {
  return days.map((day) => DAY_LABELS[day] ?? `Day ${day}`).join(', ');
}

function courseLabel(course: ScheduleCourse): string {
  return `${course.code ?? 'Unknown course'} (${course.section.sectionNumber})`;
}

function parseSectionMeetingDays(mt: SectionMeetingRow): number[] {
  const days: number[] = [];
  if (mt.monday) days.push(0);
  if (mt.tuesday) days.push(1);
  if (mt.wednesday) days.push(2);
  if (mt.thursday) days.push(3);
  if (mt.friday) days.push(4);
  return days;
}

function scheduleCourseResponse(section: SectionRow): ScheduleCourse {
  const course = toOne(section.courses);
  const professor = toOne(section.professors);
  const startMinutes = parseMinutes(section.start_time);
  const endMinutes = parseMinutes(section.end_time);

  const rawMeetings = section.section_meetings;
  const meetingsList: SectionMeetingRow[] = Array.isArray(rawMeetings)
    ? rawMeetings.filter((m): m is SectionMeetingRow => m !== null)
    : rawMeetings
      ? [rawMeetings]
      : [];

  const meetings = meetingsList.map((mt) => {
    const mtDays = parseSectionMeetingDays(mt);
    const mtStart = parseMinutes(mt.start_time);
    const mtEnd = parseMinutes(mt.end_time);
    return {
      id: mt.id,
      days: mtDays,
      startTime: mt.start_time,
      endTime: mt.end_time,
      startMinutes: mtStart,
      endMinutes: mtEnd,
      durationMinutes:
        mtStart === null || mtEnd === null ? null : mtEnd - mtStart,
      building: mt.building,
      room: mt.room,
      meetingType: mt.meeting_type,
    };
  });

  return {
    courseId: course?.id ?? section.course_id,
    code: course ? `${course.subject} ${course.course_number}` : null,
    title: course?.title ?? null,
    credits: Number(course?.credits ?? 0) || 0,
    section: {
      id: section.id,
      sectionNumber: section.section_number,
      room: section.room,
      days: parseDays(section.days),
      startTime: section.start_time,
      endTime: section.end_time,
      startMinutes,
      endMinutes,
      durationMinutes:
        startMinutes === null || endMinutes === null ? null : endMinutes - startMinutes,
      seatsTotal: section.seats_total,
      seatsRemaining: section.seats_remaining,
      linkIdentifier: section.link_identifier,
      scheduleType: section.schedule_type,
      meetings,
    },
    professor: professor
      ? { id: professor.id, firstName: professor.first_name, lastName: professor.last_name }
      : null,
  };
}

function compareScheduleCourses(first: ScheduleCourse, second: ScheduleCourse): number {
  const firstDay = first.section.days[0] ?? Number.MAX_SAFE_INTEGER;
  const secondDay = second.section.days[0] ?? Number.MAX_SAFE_INTEGER;

  if (firstDay !== secondDay) {
    return firstDay - secondDay;
  }

  const firstStart = first.section.startMinutes ?? Number.MAX_SAFE_INTEGER;
  const secondStart = second.section.startMinutes ?? Number.MAX_SAFE_INTEGER;

  if (firstStart !== secondStart) {
    return firstStart - secondStart;
  }

  return (first.code ?? '').localeCompare(second.code ?? '');
}

function scheduleSummaryResponse(schedule: Schedule, courses: ScheduleCourse[]): ScheduleSummary {
  const days = [...new Set(courses.flatMap((course) => course.section.days))].sort(
    (first, second) => first - second,
  );

  return {
    id: schedule.id,
    name: schedule.name,
    notes: schedule.notes,
    termId: schedule.term_id,
    saved: schedule.saved,
    isFavorite: schedule.is_favorite,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
    courseCount: courses.length,
    totalCredits:
      Math.round(courses.reduce((total, course) => total + course.credits, 0) * 10) / 10,
    days,
  };
}

function overlappingDays(first: ScheduleCourse, second: ScheduleCourse): number[] {
  const { startMinutes: firstStart, endMinutes: firstEnd } = first.section;
  const { startMinutes: secondStart, endMinutes: secondEnd } = second.section;

  if (firstStart === null || firstEnd === null || secondStart === null || secondEnd === null) {
    return [];
  }

  if (firstStart >= secondEnd || secondStart >= firstEnd) {
    return [];
  }

  const secondDays = new Set(second.section.days);
  return first.section.days.filter((day) => secondDays.has(day));
}

function conflictSection(course: ScheduleCourse) {
  return {
    sectionId: course.section.id,
    courseId: course.courseId,
    code: course.code,
    sectionNumber: course.section.sectionNumber,
    startTime: course.section.startTime,
    endTime: course.section.endTime,
  };
}

export function detectConflicts(courses: ScheduleCourse[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let index = 0; index < courses.length; index += 1) {
    for (let other = index + 1; other < courses.length; other += 1) {
      const first = courses[index];
      const second = courses[other];

      if (!first || !second) {
        continue;
      }

      const days = overlappingDays(first, second);

      if (days.length === 0) {
        continue;
      }

      conflicts.push({
        type: 'time',
        days,
        message: `${courseLabel(first)} overlaps with ${courseLabel(second)} on ${formatDays(days)}.`,
        sections: [conflictSection(first), conflictSection(second)],
      });
    }
  }

  return conflicts;
}

async function getScheduleOrThrow(userId: string, scheduleId: number): Promise<Schedule> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const schedule = data as Schedule | null;

  if (!schedule || schedule.user_id !== userId) {
    throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Schedule not found.');
  }

  return schedule;
}

/**
 * Counts the user's saved schedules. When `excludeId` is given, that schedule
 * is not counted (used to tell whether a schedule being saved is the first one).
 */
async function countSavedSchedules(userId: string, excludeId?: number): Promise<number> {
  const db = requireSupabaseClient();
  let query = db.from('schedules').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('saved', true);

  if (excludeId !== undefined) {
    query = query.neq('id', excludeId);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getScheduleSectionRows(scheduleIds: number[]): Promise<ScheduleSectionRow[]> {
  if (scheduleIds.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedule_sections')
    .select(SCHEDULE_SECTION_COLUMNS)
    .in('schedule_id', scheduleIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as ScheduleSectionRow[];
}

async function getCoursesBySchedule(scheduleIds: number[]): Promise<Map<number, ScheduleCourse[]>> {
  const coursesBySchedule = new Map<number, ScheduleCourse[]>();

  for (const row of await getScheduleSectionRows(scheduleIds)) {
    const section = toOne(row.sections);

    if (!section) {
      continue;
    }

    const courses = coursesBySchedule.get(row.schedule_id) ?? [];
    courses.push(scheduleCourseResponse(section));
    coursesBySchedule.set(row.schedule_id, courses);
  }

  for (const courses of coursesBySchedule.values()) {
    courses.sort(compareScheduleCourses);
  }

  return coursesBySchedule;
}

async function getScheduleDetail(schedule: Schedule): Promise<ScheduleDetail> {
  const coursesBySchedule = await getCoursesBySchedule([schedule.id]);
  const courses = coursesBySchedule.get(schedule.id) ?? [];

  return { ...scheduleSummaryResponse(schedule, courses), courses };
}

async function getSectionsOrThrow(sectionIds: number[]): Promise<SectionRow[]> {
  if (sectionIds.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const { data, error } = await db.from('sections').select(SECTION_COLUMNS).in('id', sectionIds);

  if (error) {
    throw error;
  }

  const sections = (data ?? []) as SectionRow[];

  if (sections.length !== sectionIds.length) {
    throw new AppError(404, 'SECTION_NOT_FOUND', 'One or more sections were not found.');
  }

  return sections;
}

async function getSectionOrThrow(sectionId: number): Promise<SectionRow> {
  const [section] = await getSectionsOrThrow([sectionId]);

  if (!section) {
    throw new AppError(404, 'SECTION_NOT_FOUND', 'Section not found.');
  }

  return section;
}

async function touchSchedule(scheduleId: number): Promise<Schedule> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedules')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', scheduleId)
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Schedule;
}

async function getSectionIdsForCourse(scheduleId: number, courseId: number): Promise<number[]> {
  const rows = await getScheduleSectionRows([scheduleId]);

  return rows.flatMap((row) =>
    toOne(row.sections)?.course_id === courseId ? [row.section_id] : [],
  );
}

export async function listSchedules(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<ScheduleSummary>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('schedules')
    .select(SCHEDULE_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .eq('saved', true)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  const schedules = (data ?? []) as Schedule[];
  const coursesBySchedule = await getCoursesBySchedule(schedules.map((schedule) => schedule.id));

  return createOffsetPage(
    schedules.map((schedule) =>
      scheduleSummaryResponse(schedule, coursesBySchedule.get(schedule.id) ?? []),
    ),
    count ?? 0,
    pagination,
  );
}

export async function createSchedule(
  userId: string,
  input: CreateScheduleInput,
): Promise<ScheduleDetail> {
  const sectionIds = [...new Set(input.sectionIds ?? [])];
  await getSectionsOrThrow(sectionIds);

  const saved = input.saved ?? true;
  const db = requireSupabaseClient();

  let isFirstSaved = false;

  if (saved) {
    isFirstSaved = (await countSavedSchedules(userId)) === 0;
  }

  const insertRow: Record<string, unknown> = {
    user_id: userId,
    name: input.name,
    notes: input.notes ?? null,
    term_id: input.termId ?? null,
    saved,
  };

  if (isFirstSaved) {
    insertRow.is_favorite = true;
  }

  const { data, error } = await db
    .from('schedules')
    .insert(insertRow)
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const schedule = data as Schedule;

  if (sectionIds.length) {
    const { error: sectionsError } = await db
      .from('schedule_sections')
      .insert(sectionIds.map((sectionId) => ({ schedule_id: schedule.id, section_id: sectionId })));

    if (sectionsError) {
      throw sectionsError;
    }
  }

  await trackActivity(userId, 'schedule_created', `You saved the schedule "${input.name}".`, {
    scheduleId: schedule.id,
  });

  return getScheduleDetail(schedule);
}

export async function getSchedule(userId: string, scheduleId: number): Promise<ScheduleDetail> {
  return getScheduleDetail(await getScheduleOrThrow(userId, scheduleId));
}

/** Returns the given user's most recently saved schedule, or null if they have none. */
export async function getLatestSavedScheduleForUser(
  userId: string,
): Promise<ScheduleDetail | null> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('user_id', userId)
    .eq('saved', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const schedule = data as Schedule | null;

  if (!schedule) {
    return null;
  }

  return getScheduleDetail(schedule);
}

/**
 * Returns the user's preferred saved schedule (the single schedule marked
 * `is_favorite`), or null when they have none. Never falls back to another
 * saved schedule.
 */
export async function getPreferredScheduleForUser(
  userId: string,
): Promise<ScheduleDetail | null> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('user_id', userId)
    .eq('saved', true)
    .eq('is_favorite', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const schedule = data as Schedule | null;

  if (!schedule) {
    return null;
  }

  return getScheduleDetail(schedule);
}

export async function updateSchedule(
  userId: string,
  scheduleId: number,
  input: UpdateScheduleInput,
): Promise<ScheduleDetail> {
  await getScheduleOrThrow(userId, scheduleId);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.name !== undefined) {
    patch.name = input.name;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('schedules')
    .update(patch)
    .eq('id', scheduleId)
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return getScheduleDetail(data as Schedule);
}

export async function deleteSchedule(userId: string, scheduleId: number): Promise<void> {
  const schedule = await getScheduleOrThrow(userId, scheduleId);
  const wasPreferred = schedule.is_favorite;

  const db = requireSupabaseClient();
  const { error: sectionsError } = await db
    .from('schedule_sections')
    .delete()
    .eq('schedule_id', scheduleId);

  if (sectionsError) {
    throw sectionsError;
  }

  const { error } = await db.from('schedules').delete().eq('id', scheduleId);

  if (error) {
    throw error;
  }

  // Deleting the preferred schedule promotes the latest remaining saved
  // schedule so the user still has exactly one preferred schedule.
  if (wasPreferred) {
    const { data: remaining, error: remainingError } = await db
      .from('schedules')
      .select(SCHEDULE_COLUMNS)
      .eq('user_id', userId)
      .eq('saved', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (remainingError) {
      throw remainingError;
    }

    if (remaining) {
      const { error: promoteError } = await db
        .from('schedules')
        .update({ is_favorite: true, updated_at: new Date().toISOString() })
        .eq('id', (remaining as Schedule).id);

      if (promoteError) {
        throw promoteError;
      }
    }
  }
}

async function findDraft(userId: string, termId: number | null): Promise<Schedule | null> {
  const db = requireSupabaseClient();
  let query = db
    .from('schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('user_id', userId)
    .eq('saved', false);

  if (termId == null) {
    query = query.is('term_id', null);
  } else {
    query = query.eq('term_id', termId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return (data as Schedule | null) ?? null;
}

/**
 * Returns the current unsaved draft for a (user, term), or `null` when none
 * exists. Both builders share this single draft per term so Manual Builder and
 * AI Scheduler always see the same working schedule.
 */
export async function getDraft(
  userId: string,
  termId: number | null,
): Promise<ScheduleDetail | null> {
  const schedule = await findDraft(userId, termId);

  if (!schedule) {
    return null;
  }

  return getScheduleDetail(schedule);
}

/**
 * Replaces the current draft for a (user, term) with the given sections. If no
 * draft exists yet it is created; otherwise its sections are reset to exactly
 * the supplied ones. This keeps `saved=false` so the draft never shows up in
 * Saved Schedules until the user explicitly saves it.
 */
export async function saveDraft(
  userId: string,
  termId: number | null,
  input: SaveDraftInput,
): Promise<ScheduleDetail> {
  const sectionIds = [...new Set(input.sectionIds ?? [])];
  await getSectionsOrThrow(sectionIds);

  const db = requireSupabaseClient();
  let schedule = await findDraft(userId, termId);

  if (schedule) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (input.name !== undefined) {
      patch.name = input.name;
    }

    if (input.notes !== undefined) {
      patch.notes = input.notes;
    }

    const { error: updateError } = await db.from('schedules').update(patch).eq('id', schedule.id);

    if (updateError) {
      throw updateError;
    }

    const { error: resetError } = await db
      .from('schedule_sections')
      .delete()
      .eq('schedule_id', schedule.id);

    if (resetError) {
      throw resetError;
    }
  } else {
    const { data, error } = await db
      .from('schedules')
      .insert({
        user_id: userId,
        name: input.name ?? null,
        notes: input.notes ?? null,
        term_id: termId,
        saved: false,
      })
      .select(SCHEDULE_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    schedule = data as Schedule;
  }

  if (sectionIds.length) {
    const { error: sectionsError } = await db.from('schedule_sections').insert(
      sectionIds.map((sectionId) => ({ schedule_id: (schedule as Schedule).id, section_id: sectionId })),
    );

    if (sectionsError) {
      throw sectionsError;
    }
  }

  return getScheduleDetail(schedule as Schedule);
}

/**
 * Permanently saves a draft (or an existing unsaved schedule): sets `saved` to
 * true so it appears in Saved Schedules. Also invokes the one-favorite index by
 * clearing the favorite flag first when it is already set.
 */
export async function saveSchedule(userId: string, scheduleId: number): Promise<ScheduleDetail> {
  const schedule = await getScheduleOrThrow(userId, scheduleId);

  if (schedule.saved) {
    return getScheduleDetail(schedule);
  }

  const db = requireSupabaseClient();
  const patch: Record<string, unknown> = {
    saved: true,
    updated_at: new Date().toISOString(),
  };

  if (schedule.is_favorite) {
    patch.is_favorite = false;
  }

  // A draft can never be a favorite, so if this is the user's first saved
  // schedule it automatically becomes their preferred schedule.
  if ((await countSavedSchedules(userId)) === 0) {
    patch.is_favorite = true;
  }

  const { data, error } = await db
    .from('schedules')
    .update(patch)
    .eq('id', scheduleId)
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return getScheduleDetail(data as Schedule);
}

/**
 * Marks a schedule as the single favorite for the user. Any previously
 * favourite schedule is un-favourited in the same transaction.
 */
export async function setFavorite(userId: string, scheduleId: number): Promise<ScheduleDetail> {
  await getScheduleOrThrow(userId, scheduleId);

  const db = requireSupabaseClient();
  const { error: clearError } = await db
    .from('schedules')
    .update({ is_favorite: false })
    .eq('user_id', userId)
    .eq('is_favorite', true);

  if (clearError) {
    throw clearError;
  }

  const { data, error } = await db
    .from('schedules')
    .update({ is_favorite: true, updated_at: new Date().toISOString() })
    .eq('id', scheduleId)
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return getScheduleDetail(data as Schedule);
}

/**
 * Copies a saved schedule into a fresh unsaved draft for its term. Both
 * builders pick this draft up, letting the user "load" a saved schedule and
 * then edit it / regenerate freely without mutating the saved original.
 */
export async function loadScheduleAsDraft(
  userId: string,
  scheduleId: number,
): Promise<ScheduleDetail> {
  const source = await getScheduleOrThrow(userId, scheduleId);

  if (!source.saved) {
    throw new AppError(400, 'SCHEDULE_NOT_SAVED', 'Only saved schedules can be loaded.');
  }

  const draftInput: SaveDraftInput = {
    ...(source.name != null ? { name: source.name } : {}),
    notes: source.notes ?? null,
    sectionIds: (await getScheduleSectionRows([source.id])).map((row) => row.section_id),
  };

  return saveDraft(userId, source.term_id, draftInput);
}

export async function addScheduleCourse(
  userId: string,
  scheduleId: number,
  sectionId: number,
): Promise<ScheduleDetail> {
  await getScheduleOrThrow(userId, scheduleId);

  await getSectionsOrThrow([sectionId]);
  const rows = await getScheduleSectionRows([scheduleId]);

  if (rows.some((row) => row.section_id === sectionId)) {
    throw new AppError(409, 'SECTION_ALREADY_IN_SCHEDULE', 'This section is already scheduled.');
  }

  const db = requireSupabaseClient();
  const { error } = await db
    .from('schedule_sections')
    .insert({ schedule_id: scheduleId, section_id: sectionId });

  if (error) {
    throw error;
  }

  return getScheduleDetail(await touchSchedule(scheduleId));
}

export async function removeScheduleCourse(
  userId: string,
  scheduleId: number,
  courseId: number,
): Promise<void> {
  await getScheduleOrThrow(userId, scheduleId);

  const sectionIds = await getSectionIdsForCourse(scheduleId, courseId);

  if (sectionIds.length === 0) {
    throw new AppError(404, 'COURSE_NOT_IN_SCHEDULE', 'This course is not in the schedule.');
  }

  const db = requireSupabaseClient();
  const { error } = await db
    .from('schedule_sections')
    .delete()
    .eq('schedule_id', scheduleId)
    .in('section_id', sectionIds);

  if (error) {
    throw error;
  }

  await touchSchedule(scheduleId);
}

export async function swapScheduleSection(
  userId: string,
  scheduleId: number,
  courseId: number,
  sectionId: number,
): Promise<ScheduleDetail> {
  await getScheduleOrThrow(userId, scheduleId);

  const section = await getSectionOrThrow(sectionId);

  if (section.course_id !== courseId) {
    throw new AppError(
      400,
      'SECTION_COURSE_MISMATCH',
      'The requested section belongs to a different course.',
    );
  }

  const currentSectionIds = await getSectionIdsForCourse(scheduleId, courseId);

  if (currentSectionIds.length === 0) {
    throw new AppError(404, 'COURSE_NOT_IN_SCHEDULE', 'This course is not in the schedule.');
  }

  if (currentSectionIds.includes(sectionId)) {
    return getScheduleDetail(await getScheduleOrThrow(userId, scheduleId));
  }

  const db = requireSupabaseClient();
  const { error: deleteError } = await db
    .from('schedule_sections')
    .delete()
    .eq('schedule_id', scheduleId)
    .in('section_id', currentSectionIds);

  if (deleteError) {
    throw deleteError;
  }

  const { error } = await db
    .from('schedule_sections')
    .insert({ schedule_id: scheduleId, section_id: sectionId });

  if (error) {
    throw error;
  }

  return getScheduleDetail(await touchSchedule(scheduleId));
}

export async function compareSchedules(userId: string, scheduleIds: number[]) {
  const schedules = await Promise.all(
    scheduleIds.map((scheduleId) => getSchedule(userId, scheduleId)),
  );
  const [first, second] = schedules;

  if (!first || !second) {
    throw new AppError(400, 'INVALID_COMPARISON', 'Two schedules are required for a comparison.');
  }

  const secondByCourseId = new Map(
    second.courses.flatMap((course) =>
      course.courseId === null ? [] : [[course.courseId, course] as const],
    ),
  );
  const firstCourseIds = new Set(
    first.courses.flatMap((course) => (course.courseId === null ? [] : [course.courseId])),
  );

  const sharedCourses = first.courses.flatMap((course) => {
    const match = course.courseId === null ? undefined : secondByCourseId.get(course.courseId);

    if (!match) {
      return [];
    }

    return [
      {
        courseId: course.courseId,
        code: course.code,
        title: course.title,
        credits: course.credits,
        sameSection: match.section.id === course.section.id,
      },
    ];
  });

  return {
    schedules,
    sharedCourses,
    onlyInFirst: first.courses.filter(
      (course) => course.courseId === null || !secondByCourseId.has(course.courseId),
    ),
    onlyInSecond: second.courses.filter(
      (course) => course.courseId === null || !firstCourseIds.has(course.courseId),
    ),
  };
}

export async function getScheduleConflicts(userId: string, scheduleId: number) {
  const schedule = await getSchedule(userId, scheduleId);
  const conflicts = detectConflicts(schedule.courses);

  return { scheduleId: schedule.id, conflictCount: conflicts.length, conflicts };
}
