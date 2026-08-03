import { requireSupabaseClient } from '../db/supabase.js';
import type { Professor, ProfessorReview } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type ProfessorListInput = {
  search?: string;
  sort: 'name' | 'rating' | 'difficulty' | 'popularity';
  order: 'asc' | 'desc';
  pagination: OffsetPagination;
};

export type ProfessorSummary = {
  id: number;
  firstName: string;
  lastName: string;
  department: string | null;
  title: string | null;
  reviewCount: number;
  averageRating: number | null;
  averageDifficulty: number | null;
  wouldRetakePercentage: number | null;
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

async function getProfessorSummaries(professors: Professor[]): Promise<ProfessorSummary[]> {
  if (professors.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const professorIds = professors.map((professor) => professor.id);
  const { data, error } = await db
    .from('professor_reviews')
    .select('id, user_id, professor_id, rating, difficulty, would_retake, comment, created_at')
    .in('professor_id', professorIds);

  if (error) {
    throw error;
  }

  const reviewsByProfessor = new Map<number, ProfessorReview[]>();

  for (const review of (data ?? []) as ProfessorReview[]) {
    if (review.professor_id === null) {
      continue;
    }

    const reviews = reviewsByProfessor.get(review.professor_id) ?? [];
    reviews.push(review);
    reviewsByProfessor.set(review.professor_id, reviews);
  }

  return professors.map((professor) => {
    const reviews = reviewsByProfessor.get(professor.id) ?? [];
    const difficulties = reviews.flatMap((review) =>
      review.difficulty === null ? [] : [review.difficulty],
    );
    const retakeVotes = reviews.flatMap((review) =>
      review.would_retake === null ? [] : [review.would_retake],
    );

    return {
      id: professor.id,
      firstName: professor.first_name,
      lastName: professor.last_name,
      department: professor.department,
      title: professor.title,
      reviewCount: reviews.length,
      averageRating: reviews.length
        ? round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length)
        : null,
      averageDifficulty: difficulties.length
        ? round(difficulties.reduce((sum, difficulty) => sum + difficulty, 0) / difficulties.length)
        : null,
      wouldRetakePercentage: retakeVotes.length
        ? round((retakeVotes.filter(Boolean).length / retakeVotes.length) * 100)
        : null,
    };
  });
}

export async function listProfessors(
  input: ProfessorListInput,
): Promise<OffsetPage<ProfessorSummary>> {
  const db = requireSupabaseClient();
  let query = db.from('professors').select('*');

  if (input.search) {
    const search = input.search.replace(/[(),]/g, '');
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,department.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const professors = await getProfessorSummaries((data ?? []) as Professor[]);
  const direction = input.order === 'asc' ? 1 : -1;

  professors.sort((first, second) => {
    if (input.sort === 'name') {
      return (
        direction *
        `${first.lastName} ${first.firstName}`.localeCompare(
          `${second.lastName} ${second.firstName}`,
        )
      );
    }

    if (input.sort === 'rating') {
      return direction * ((first.averageRating ?? 0) - (second.averageRating ?? 0));
    }

    if (input.sort === 'difficulty') {
      return direction * ((first.averageDifficulty ?? 0) - (second.averageDifficulty ?? 0));
    }

    return direction * (first.reviewCount - second.reviewCount);
  });

  const { offset, limit } = input.pagination;
  return createOffsetPage(
    professors.slice(offset, offset + limit),
    professors.length,
    input.pagination,
  );
}

export async function getProfessor(id: number) {
  const db = requireSupabaseClient();
  const { data, error } = await db.from('professors').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'PROFESSOR_NOT_FOUND', 'Professor not found.');
  }

  const [summary] = await getProfessorSummaries([data as Professor]);

  if (!summary) {
    throw new AppError(500, 'PROFESSOR_SUMMARY_MISSING', 'Professor summary could not be created.');
  }

  const [{ data: sections, error: sectionsError }, { data: reviews, error: reviewsError }] =
    await Promise.all([
      db
        .from('sections')
        .select('courses(id, subject, course_number, title)')
        .eq('professor_id', id),
      db.from('professor_reviews').select('rating').eq('professor_id', id),
    ]);

  if (sectionsError) {
    throw sectionsError;
  }

  if (reviewsError) {
    throw reviewsError;
  }

  const ratingBreakdown = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: (reviews ?? []).filter((review) => review.rating === rating).length,
  }));

  return {
    ...summary,
    courses: sections ?? [],
    ratingBreakdown,
  };
}
