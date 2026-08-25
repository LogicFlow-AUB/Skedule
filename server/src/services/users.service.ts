import { requireSupabaseClient, requireAuthClient } from '../db/supabase.js';
import type { CourseReview, ProfessorReview, User } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';
import * as notificationsService from './notifications.service.js';

export type ProfileUpdateInput = {
  firstName?: string;
  lastName?: string;
  major?: string;
  level?: string;
};

export type NotificationSettingsInput = Partial<{
  friendRequests: boolean;
  friendAcceptances: boolean;
  postLikes: boolean;
  postComments: boolean;
  reviewLikes: boolean;
  scheduleShares: boolean;
  registrationReminders: boolean;
}>;

export type PrivacySettingsInput = Partial<{
  profileVisibility: 'public' | 'friends' | 'private';
  showCompletedCourses: boolean;
  showSchedule: boolean;
  showOnlineStatus: boolean;
}>;

export type PasswordChangeInput = {
  currentPassword: string;
  password: string;
  confirmPassword: string;
};

export type ThemeInput = {
  theme: 'light' | 'dark' | 'system';
};

export type AvatarInput = {
  avatarUrl: string;
};

export type UserProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  major: string | null;
  level: string | null;
};

export type UserStats = {
  courseReviewCount: number;
  professorReviewCount: number;
  friendCount: number;
  scheduleCount: number;
};

export type ReviewResponse = {
  id: number;
  type: 'course' | 'professor';
  rating: number;
  difficulty: number | null;
  workload: number | null;
  comment: string | null;
  createdAt: string;
  course: { id: number; title: string } | null;
  professor: { id: number; firstName: string; lastName: string } | null;
};

type CourseReviewRow = CourseReview & { courses: { id: number; title: string } | null };
type ProfessorReviewRow = ProfessorReview & {
  professors: { id: number; first_name: string; last_name: string } | null;
};

async function findUser(userId: string): Promise<User | null> {
  const db = requireSupabaseClient();
  const { data } = await db.from('users').select('*').eq('id', userId).maybeSingle();

  return data ?? null;
}

async function getUserOrThrow(userId: string): Promise<User> {
  const user = await findUser(userId);

  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return user;
}

function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    major: user.major,
    level: user.level,
  };
}

export async function getProfile(userId: string): Promise<UserProfile> {
  return toProfile(await getUserOrThrow(userId));
}

export async function getAchievements(): Promise<unknown[]> {
  return [];
}

export async function getFavoriteProfessors(): Promise<unknown[]> {
  return [];
}

export async function getWishlist(): Promise<unknown[]> {
  return [];
}

export async function getCompletedCourses(): Promise<unknown[]> {
  return [];
}

export async function getStats(userId: string): Promise<UserStats> {
  const db = requireSupabaseClient();
  const [courseReviews, professorReviews, friendships, schedules] = await Promise.all([
    db.from('course_reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('professor_reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted'),
    db.from('schedules').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  return {
    courseReviewCount: courseReviews.count ?? 0,
    professorReviewCount: professorReviews.count ?? 0,
    friendCount: friendships.count ?? 0,
    scheduleCount: schedules.count ?? 0,
  };
}

export async function getReviews(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReviewResponse>> {
  const db = requireSupabaseClient();
  const [courseReviews, professorReviews] = await Promise.all([
    db.from('course_reviews').select('*, courses(id, title)').eq('user_id', userId),
    db
      .from('professor_reviews')
      .select('*, professors(id, first_name, last_name)')
      .eq('user_id', userId),
  ]);

  const courseRows = (courseReviews.data ?? []) as CourseReviewRow[];
  const professorRows = (professorReviews.data ?? []) as ProfessorReviewRow[];

  const reviews: ReviewResponse[] = [
    ...courseRows.map((row) => ({
      id: row.id,
      type: 'course' as const,
      rating: row.rating,
      difficulty: row.difficulty,
      workload: row.workload,
      comment: row.comment,
      createdAt: row.created_at,
      course: row.courses ? { id: row.courses.id, title: row.courses.title } : null,
      professor: null,
    })),
    ...professorRows.map((row) => ({
      id: row.id,
      type: 'professor' as const,
      rating: row.rating,
      difficulty: null,
      workload: null,
      comment: row.comment,
      createdAt: row.created_at,
      course: null,
      professor: row.professors
        ? {
            id: row.professors.id,
            firstName: row.professors.first_name,
            lastName: row.professors.last_name,
          }
        : null,
    })),
  ];

  reviews.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return createOffsetPage(
    reviews.slice(pagination.offset, pagination.offset + pagination.limit),
    reviews.length,
    pagination,
  );
}

export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<UserProfile> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('users')
    .update({
      ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
      ...(input.lastName !== undefined ? { last_name: input.lastName } : {}),
      ...(input.major !== undefined ? { major: input.major } : {}),
      ...(input.level !== undefined ? { level: input.level } : {}),
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return toProfile(data);
}

export async function updateNotificationSettings(userId: string, input: NotificationSettingsInput) {
  return notificationsService.updatePreferences(userId, input);
}

export async function updatePrivacySettings(_userId: string, _input: PrivacySettingsInput) {
  return {
    profileVisibility: 'public' as const,
    showCompletedCourses: true,
    showSchedule: true,
    showOnlineStatus: true,
  };
}

export async function changePassword(userId: string, input: PasswordChangeInput): Promise<void> {
  if (input.password !== input.confirmPassword) {
    throw new AppError(400, 'PASSWORD_CONFIRMATION_MISMATCH', 'Passwords do not match.');
  }

  const user = await getUserOrThrow(userId);
  const authDb = requireAuthClient();

  const { error: verifyError } = await authDb.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });

  if (verifyError) {
    throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect.');
  }

  const { error: updateError } = await authDb.auth.admin.updateUserById(userId, {
    password: input.password,
  });

  if (updateError) {
    throw updateError;
  }
}

export async function updateTheme(_userId: string, input: ThemeInput): Promise<ThemeInput> {
  return { theme: input.theme };
}

export async function updateAvatar(
  _userId: string,
  _input: AvatarInput,
): Promise<{ avatarUrl: string | null }> {
  return { avatarUrl: null };
}

export async function deleteAccount(userId: string): Promise<void> {
  const db = requireSupabaseClient();

  const { error: deleteError } = await db.from('users').delete().eq('id', userId);
  if (deleteError) {
    throw deleteError;
  }

  const authDb = requireAuthClient();
  const { error: authError } = await authDb.auth.admin.deleteUser(userId);
  if (authError) {
    throw authError;
  }
}
