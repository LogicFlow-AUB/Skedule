import { requireSupabaseClient } from '../db/supabase.js';
import type { CourseReview, ProfessorReview, User } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { getCourse } from './courses.service.js';
import { trackActivity } from './activity.service.js';
import { notifyReviewLiked } from './notifications.service.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type CreateCourseReviewInput = {
  rating: number;
  difficulty?: number;
  workload?: number;
  wouldRetake?: boolean;
  comment?: string;
};

export type CreateProfessorReviewInput = {
  rating: number;
  difficulty?: number;
  wouldRetake?: boolean;
  comment?: string;
};

type CourseReviewWithAuthor = CourseReview & { users: User | null };
type ProfessorReviewWithAuthor = ProfessorReview & { users: User | null };

function reviewAuthor(user: User | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
  };
}

function courseReviewResponse(review: CourseReviewWithAuthor) {
  return {
    id: review.id,
    rating: review.rating,
    difficulty: review.difficulty,
    workload: review.workload,
    wouldRetake: review.would_retake,
    comment: review.comment,
    createdAt: review.created_at,
    author: reviewAuthor(review.users),
  };
}

function professorReviewResponse(review: ProfessorReviewWithAuthor) {
  return {
    id: review.id,
    rating: review.rating,
    difficulty: review.difficulty,
    wouldRetake: review.would_retake,
    comment: review.comment,
    createdAt: review.created_at,
    author: reviewAuthor(review.users),
  };
}

export async function getCourseReviewStats(courseId: number) {
  const db = requireSupabaseClient();
  const [{ data: reviews, error: reviewsError }, { data: gradeDistribution, error: gradesError }] =
    await Promise.all([
      db.from('course_reviews').select('rating, difficulty, workload').eq('course_id', courseId),
      db
        .from('course_grade_distributions')
        .select('grade, percentage, term_id')
        .eq('course_id', courseId)
        .order('grade'),
    ]);

  if (reviewsError) {
    throw reviewsError;
  }

  if (gradesError) {
    throw gradesError;
  }

  const rows = reviews ?? [];
  const difficulties = rows.flatMap((review) =>
    review.difficulty === null ? [] : [review.difficulty],
  );
  const workloads = rows.flatMap((review) => (review.workload === null ? [] : [review.workload]));

  return {
    reviewCount: rows.length,
    averageRating: rows.length
      ? Math.round((rows.reduce((sum, review) => sum + review.rating, 0) / rows.length) * 10) / 10
      : null,
    averageDifficulty: difficulties.length
      ? Math.round(
          (difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length) * 10,
        ) / 10
      : null,
    averageWorkload: workloads.length
      ? Math.round((workloads.reduce((sum, value) => sum + value, 0) / workloads.length) * 10) / 10
      : null,
    gradeDistribution: gradeDistribution ?? [],
  };
}

export async function createCourseReview(
  userId: string,
  courseCode: string,
  input: CreateCourseReviewInput,
) {
  const course = await getCourse(courseCode);
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('course_reviews')
    .insert({
      user_id: userId,
      course_id: course.id,
      rating: input.rating,
      difficulty: input.difficulty ?? null,
      workload: input.workload ?? null,
      would_retake: input.wouldRetake ?? null,
      comment: input.comment ?? null,
    })
    .select('*, users(id, first_name, last_name, email, major, level)')
    .single();

  if (error) {
    throw error;
  }

  const review = courseReviewResponse(data as CourseReviewWithAuthor);
  const stats = await getCourseReviewStats(course.id);

  await trackActivity(userId, 'course_review_created', `You reviewed ${course.code}.`, {
    courseId: course.id,
    reviewId: review.id,
  });

  return { review, stats };
}

export async function getCourseReviews(
  courseCode: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReturnType<typeof courseReviewResponse>>> {
  const course = await getCourse(courseCode);
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('course_reviews')
    .select('*, users(id, first_name, last_name, email, major, level)', { count: 'exact' })
    .eq('course_id', course.id)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(
    (data ?? []).map((review) => courseReviewResponse(review as CourseReviewWithAuthor)),
    count ?? 0,
    pagination,
  );
}

export async function saveCourse(userId: string, courseCode: string): Promise<void> {
  const course = await getCourse(courseCode);
  const db = requireSupabaseClient();
  const { error } = await db
    .from('course_saves')
    .upsert({ user_id: userId, course_id: course.id }, { onConflict: 'user_id,course_id' });

  if (error) {
    throw error;
  }
}

export async function unsaveCourse(userId: string, courseCode: string): Promise<void> {
  const course = await getCourse(courseCode);
  const db = requireSupabaseClient();
  const { error } = await db
    .from('course_saves')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', course.id);

  if (error) {
    throw error;
  }
}

export async function createProfessorReview(
  userId: string,
  professorId: number,
  input: CreateProfessorReviewInput,
) {
  const db = requireSupabaseClient();
  const { data: professor, error: professorError } = await db
    .from('professors')
    .select('id')
    .eq('id', professorId)
    .maybeSingle();

  if (professorError) {
    throw professorError;
  }

  if (!professor) {
    throw new AppError(404, 'PROFESSOR_NOT_FOUND', 'Professor not found.');
  }

  const { data, error } = await db
    .from('professor_reviews')
    .insert({
      user_id: userId,
      professor_id: professorId,
      rating: input.rating,
      difficulty: input.difficulty ?? null,
      would_retake: input.wouldRetake ?? null,
      comment: input.comment ?? null,
    })
    .select(
      '*, users!professor_reviews_user_id_fkey(id, first_name, last_name, email, major, level)',
    )
    .single();

  if (error) {
    throw error;
  }

  const review = professorReviewResponse(data as ProfessorReviewWithAuthor);
  await trackActivity(userId, 'professor_review_created', 'You posted a professor review.', {
    professorId,
    reviewId: review.id,
  });

  return review;
}

export async function getProfessorReviews(
  professorId: number,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReturnType<typeof professorReviewResponse>>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('professor_reviews')
    .select(
      '*, users!professor_reviews_user_id_fkey(id, first_name, last_name, email, major, level)',
      { count: 'exact' },
    )
    .eq('professor_id', professorId)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(
    (data ?? []).map((review) => professorReviewResponse(review as ProfessorReviewWithAuthor)),
    count ?? 0,
    pagination,
  );
}

async function getProfessorReviewOrThrow(professorId: number, reviewId: number) {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('professor_reviews')
    .select('id')
    .eq('id', reviewId)
    .eq('professor_id', professorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
  }
}

export async function likeProfessorReview(
  userId: string,
  professorId: number,
  reviewId: number,
): Promise<void> {
  await getProfessorReviewOrThrow(professorId, reviewId);

  const db = requireSupabaseClient();

  const { data: reviewRow, error: fetchError } = await db
    .from('professor_reviews')
    .select('user_id')
    .eq('id', reviewId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  const { error } = await db
    .from('professor_review_likes')
    .upsert({ review_id: reviewId, user_id: userId }, { onConflict: 'review_id,user_id' });

  if (error) {
    throw error;
  }

  if (reviewRow && (reviewRow as { user_id: string }).user_id !== userId) {
    await notifyReviewLiked((reviewRow as { user_id: string }).user_id, userId, reviewId);
  }
}

export async function reportProfessorReview(
  userId: string,
  professorId: number,
  reviewId: number,
  reason: string,
): Promise<void> {
  await getProfessorReviewOrThrow(professorId, reviewId);

  const db = requireSupabaseClient();
  const { error } = await db
    .from('professor_review_reports')
    .upsert({ review_id: reviewId, user_id: userId, reason }, { onConflict: 'review_id,user_id' });

  if (error) {
    throw error;
  }
}
