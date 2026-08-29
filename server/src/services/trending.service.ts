import { requireSupabaseClient } from '../db/supabase.js';

// No cron/job runner exists yet (see BACKEND_TODO Phase 10), so trending is
// computed on-the-fly from reviews posted within a recent window.
const TRENDING_WINDOW_DAYS = 30;

type ReviewCounts = Map<number, { count: number; ratingSum: number }>;

async function getRecentReviewCounts(
  table: 'course_reviews' | 'professor_reviews',
  idColumn: 'course_id' | 'professor_id',
): Promise<ReviewCounts> {
  const db = requireSupabaseClient();
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from(table)
    .select(`${idColumn}, rating`)
    .gte('created_at', since);

  if (error) {
    throw error;
  }

  const counts: ReviewCounts = new Map();
  const rows = (data ?? []) as {
    course_id?: number | null;
    professor_id?: number | null;
    rating: number;
  }[];

  for (const row of rows) {
    const id = row[idColumn];

    if (id === null || id === undefined) {
      continue;
    }

    const rating = row.rating;

    const entry = counts.get(id) ?? { count: 0, ratingSum: 0 };
    entry.count += 1;
    entry.ratingSum += rating;
    counts.set(id, entry);
  }

  return counts;
}

function topIds(counts: ReviewCounts, limit: number): number[] {
  return [...counts.keys()]
    .sort((first, second) => (counts.get(second)?.count ?? 0) - (counts.get(first)?.count ?? 0))
    .slice(0, limit);
}

export type TrendingCourse = {
  id: number;
  code: string;
  title: string;
  department: string | null;
  recentReviewCount: number;
  averageRating: number;
};

export async function getTrendingCourses(limit: number): Promise<TrendingCourse[]> {
  const counts = await getRecentReviewCounts('course_reviews', 'course_id');
  const ids = topIds(counts, limit);

  if (ids.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('courses')
    .select('id, subject, course_number, title, department')
    .in('id', ids);

  if (error) {
    throw error;
  }

  const coursesById = new Map(
    (data ?? []).map((course) => [
      course.id as number,
      course as {
        id: number;
        subject: string;
        course_number: string;
        title: string;
        department: string | null;
      },
    ]),
  );

  return ids.flatMap((id) => {
    const course = coursesById.get(id);
    const stats = counts.get(id);

    if (!course || !stats) {
      return [];
    }

    return [
      {
        id: course.id,
        code: `${course.subject} ${course.course_number}`,
        title: course.title,
        department: course.department,
        recentReviewCount: stats.count,
        averageRating: Math.round((stats.ratingSum / stats.count) * 10) / 10,
      },
    ];
  });
}

export type TrendingProfessor = {
  id: number;
  firstName: string;
  lastName: string;
  department: string | null;
  recentReviewCount: number;
  averageRating: number;
};

export async function getTrendingProfessors(limit: number): Promise<TrendingProfessor[]> {
  const counts = await getRecentReviewCounts('professor_reviews', 'professor_id');
  const ids = topIds(counts, limit);

  if (ids.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('professors')
    .select('id, first_name, last_name, department')
    .in('id', ids);

  if (error) {
    throw error;
  }

  const professorsById = new Map(
    (data ?? []).map((professor) => [
      professor.id as number,
      professor as { id: number; first_name: string; last_name: string; department: string | null },
    ]),
  );

  return ids.flatMap((id) => {
    const professor = professorsById.get(id);
    const stats = counts.get(id);

    if (!professor || !stats) {
      return [];
    }

    return [
      {
        id: professor.id,
        firstName: professor.first_name,
        lastName: professor.last_name,
        department: professor.department,
        recentReviewCount: stats.count,
        averageRating: Math.round((stats.ratingSum / stats.count) * 10) / 10,
      },
    ];
  });
}
