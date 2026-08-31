import { requireSupabaseClient } from '../db/supabase.js';
import type { Course, CourseReview, Professor, Section, SectionMeeting } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type CourseListInput = {
  search?: string;
  attribute?: string;
  termId?: number;
  sort: 'name' | 'rating' | 'difficulty' | 'workload' | 'popularity';
  order: 'asc' | 'desc';
  pagination: OffsetPagination;
};

export type OptimizerProfessorOption = { id: number; first_name: string; last_name: string };

export type CourseSummary = {
  id: number;
  code: string;
  title: string;
  department: string | null;
  college: string | null;
  level: string | null;
  credits: string;
  attributes: string[];
  enrolledCount: number;
  reviewCount: number;
  averageRating: number | null;
  averageDifficulty: number | null;
  averageWorkload: number | null;
  wouldRetakePercentage: number | null;
  /** Professors teaching this course in the requested term (only populated when a term is specified). */
  professors?: OptimizerProfessorOption[];
};

type SectionEnrollment = {
  course_id: number | null;
  seats_total: number | null;
  seats_remaining: number | null;
};

type CourseAttribute = {
  course_id: number;
  attributes: { name: string }[];
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function splitCourseCode(code: string) {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, ' ').trim();
  const parts = normalized.split(' ');

  if (parts.length >= 2) {
    return {
      subject: parts.slice(0, -1).join(' '),
      courseNumber: parts.at(-1) ?? '',
    };
  }

  // Handle unspaced codes such as "MATH201" or "CMPS214L".
  const unspaced = /^([A-Z]{2,6})(\d{1,4}[A-Z]?)$/.exec(normalized);
  if (unspaced?.[1] && unspaced?.[2]) {
    return { subject: unspaced[1], courseNumber: unspaced[2] };
  }

  throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found.');
}

async function getCourseSummaries(courses: Course[]): Promise<CourseSummary[]> {
  if (courses.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const courseIds = courses.map((course) => course.id);
  const [reviewsResult, sectionsResult, attributesResult] = await Promise.all([
    db
      .from('course_reviews')
      .select(
        'id, user_id, course_id, rating, difficulty, workload, would_retake, comment, created_at',
      )
      .in('course_id', courseIds),
    db
      .from('sections')
      .select('course_id, seats_total, seats_remaining')
      .in('course_id', courseIds),
    db.from('course_attributes').select('course_id, attributes(name)').in('course_id', courseIds),
  ]);

  if (reviewsResult.error) {
    throw reviewsResult.error;
  }

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (attributesResult.error) {
    throw attributesResult.error;
  }

  const reviewsByCourse = new Map<number, CourseReview[]>();
  const enrollmentByCourse = new Map<number, number>();
  const attributesByCourse = new Map<number, string[]>();

  for (const review of (reviewsResult.data ?? []) as CourseReview[]) {
    if (review.course_id === null) {
      continue;
    }

    const reviews = reviewsByCourse.get(review.course_id) ?? [];
    reviews.push(review);
    reviewsByCourse.set(review.course_id, reviews);
  }

  for (const section of (sectionsResult.data ?? []) as SectionEnrollment[]) {
    if (section.course_id === null) {
      continue;
    }

    const enrolled = Math.max(0, (section.seats_total ?? 0) - (section.seats_remaining ?? 0));
    enrollmentByCourse.set(
      section.course_id,
      (enrollmentByCourse.get(section.course_id) ?? 0) + enrolled,
    );
  }

  for (const row of (attributesResult.data ?? []) as CourseAttribute[]) {
    const attr = row.attributes;
    const names: string[] = Array.isArray(attr)
      ? attr.map((a: { name: string }) => a.name)
      : attr && typeof attr === 'object'
        ? [(attr as { name: string }).name]
        : [];
    const existing = attributesByCourse.get(row.course_id) ?? [];
    existing.push(...names);
    attributesByCourse.set(row.course_id, existing);
  }

  return courses.map((course) => {
    const reviews = reviewsByCourse.get(course.id) ?? [];
    const difficulties = reviews.flatMap((review) =>
      review.difficulty === null ? [] : [review.difficulty],
    );
    const workloads = reviews.flatMap((review) =>
      review.workload === null ? [] : [review.workload],
    );
    const retakeVotes = reviews.flatMap((review) =>
      review.would_retake === null ? [] : [review.would_retake],
    );

    return {
      id: course.id,
      code: `${course.subject} ${course.course_number}`,
      title: course.title,
      department: course.department,
      college: course.college,
      level: course.level,
      credits: course.credits,
      attributes: attributesByCourse.get(course.id) ?? [],
      enrolledCount: enrollmentByCourse.get(course.id) ?? 0,
      reviewCount: reviews.length,
      averageRating: reviews.length
        ? round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length)
        : null,
      averageDifficulty: difficulties.length
        ? round(difficulties.reduce((sum, difficulty) => sum + difficulty, 0) / difficulties.length)
        : null,
      averageWorkload: workloads.length
        ? round(workloads.reduce((sum, workload) => sum + workload, 0) / workloads.length)
        : null,
      wouldRetakePercentage: retakeVotes.length
        ? round((retakeVotes.filter(Boolean).length / retakeVotes.length) * 100)
        : null,
    };
  });
}

type SectionProfessorRow = {
  course_id: number | null;
  professors: OptimizerProfessorOption | OptimizerProfessorOption[] | null;
};

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Attaches each course the professors who teach it in a given term, gathered
 * from that term's sections. Used to keep the shared course search (which is
 * term-agnostic for the course set) able to surface term-professors for the
 * schedule builder's professor preferences.
 */
async function attachTermProfessors(
  summaries: CourseSummary[],
  termId: number,
): Promise<void> {
  if (summaries.length === 0) return;

  const db = requireSupabaseClient();
  const courseIds = summaries.map((course) => course.id);
  const { data, error } = await db
    .from('sections')
    .select('course_id, professors(id, first_name, last_name)')
    .eq('term_id', termId)
    .in('course_id', courseIds);
  if (error) throw error;

  const byCourse = new Map<number, OptimizerProfessorOption[]>();
  const seen = new Set<string>();
  for (const row of (data ?? []) as SectionProfessorRow[]) {
    const professor = toOne(row.professors);
    if (!professor || row.course_id == null) continue;
    const key = `${row.course_id}:${professor.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byCourse.get(row.course_id) ?? [];
    list.push(professor);
    byCourse.set(row.course_id, list);
  }

  for (const course of summaries) {
    course.professors = (byCourse.get(course.id) ?? []).sort((a, b) =>
      a.last_name.localeCompare(b.last_name),
    );
  }
}

export async function listCourses(input: CourseListInput): Promise<OffsetPage<CourseSummary>> {
  const db = requireSupabaseClient();
  let query = db.from('courses').select('*');

  if (input.search) {
    const search = input.search.replace(/[(),]/g, '');
    query = query.or(
      `subject.ilike.%${search}%,course_number.ilike.%${search}%,title.ilike.%${search}%,department.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let courses = await getCourseSummaries((data ?? []) as Course[]);

  if (input.attribute) {
    const attribute = input.attribute.toLowerCase();
    courses = courses.filter((course) =>
      course.attributes.some((courseAttribute) => courseAttribute.toLowerCase() === attribute),
    );
  }

  if (input.termId != null) {
    await attachTermProfessors(courses, input.termId);
  }

  const direction = input.order === 'asc' ? 1 : -1;
  courses.sort((first, second) => {
    if (input.sort === 'name') {
      return direction * first.code.localeCompare(second.code);
    }

    if (input.sort === 'rating') {
      return direction * ((first.averageRating ?? 0) - (second.averageRating ?? 0));
    }

    if (input.sort === 'difficulty') {
      return direction * ((first.averageDifficulty ?? 0) - (second.averageDifficulty ?? 0));
    }

    if (input.sort === 'workload') {
      return direction * ((first.averageWorkload ?? 0) - (second.averageWorkload ?? 0));
    }

    return direction * (first.enrolledCount - second.enrolledCount);
  });

  const { offset, limit } = input.pagination;
  return createOffsetPage(courses.slice(offset, offset + limit), courses.length, input.pagination);
}

export async function getCourse(code: string): Promise<CourseSummary> {
  const { subject, courseNumber } = splitCourseCode(code);
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('courses')
    .select('*')
    .eq('subject', subject)
    .eq('course_number', courseNumber)
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found.');
  }

  const [summary] = await getCourseSummaries([data[0] as Course]);

  if (!summary) {
    throw new AppError(500, 'COURSE_SUMMARY_MISSING', 'Course summary could not be created.');
  }

  return summary;
}

export type CourseSection = Section & {
  professors: Pick<Professor, 'id' | 'first_name' | 'last_name'> | null;
  section_meetings: SectionMeeting[];
};

export async function getSections(code: string, termId?: number | null): Promise<CourseSection[]> {
  const course = await getCourse(code);
  const db = requireSupabaseClient();
  let query = db
    .from('sections')
    .select('*, professors(id, first_name, last_name), section_meetings(*)')
    .eq('course_id', course.id);

  if (termId != null) {
    query = query.eq('term_id', termId);
  }

  const { data, error } = await query.order('section_number');

  if (error) {
    throw error;
  }

  return (data ?? []) as CourseSection[];
}

export async function getGradeDistribution(code: string): Promise<unknown[]> {
  const course = await getCourse(code);
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('course_grade_distributions')
    .select('grade, percentage, term_id')
    .eq('course_id', course.id)
    .order('grade');

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function compareCourses(codes: string[]) {
  return { courses: await Promise.all(codes.map((code) => getCourse(code))) };
}
