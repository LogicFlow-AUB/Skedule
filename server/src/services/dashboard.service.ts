import { requireSupabaseClient } from '../db/supabase.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

type ScheduleSectionRow = {
  sections: { courses: { credits: string }[] }[];
};

export async function getDashboardStats(userId: string) {
  const db = requireSupabaseClient();
  const [
    latestScheduleResult,
    schedulesCountResult,
    courseReviewsResult,
    professorReviewsResult,
    friendshipsResult,
  ] = await Promise.all([
    db
      .from('schedules')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('schedules').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('course_reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('professor_reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted'),
  ]);

  if (latestScheduleResult.error) {
    throw latestScheduleResult.error;
  }

  if (courseReviewsResult.error) {
    throw courseReviewsResult.error;
  }

  if (schedulesCountResult.error) {
    throw schedulesCountResult.error;
  }

  if (professorReviewsResult.error) {
    throw professorReviewsResult.error;
  }

  if (friendshipsResult.error) {
    throw friendshipsResult.error;
  }

  let creditsEnrolled = 0;

  if (latestScheduleResult.data) {
    const { data, error } = await db
      .from('schedule_sections')
      .select('sections(courses(credits))')
      .eq('schedule_id', latestScheduleResult.data.id);

    if (error) {
      throw error;
    }

    creditsEnrolled = (data ?? []).reduce((total, row) => {
      const section = (row as ScheduleSectionRow).sections[0];
      const course = section?.courses[0];
      return total + Number(course?.credits ?? 0);
    }, 0);
  }

  const friendIds = (friendshipsResult.data ?? []).map((friendship) =>
    friendship.user_id === userId ? friendship.friend_id : friendship.user_id,
  );
  let friendsOnline = 0;

  if (friendIds.length) {
    const { count, error } = await db
      .from('users')
      .select('*', { count: 'exact', head: true })
      .in('id', friendIds)
      .eq('presence_status', 'online');

    if (error) {
      throw error;
    }

    friendsOnline = count ?? 0;
  }

  return {
    creditsEnrolled,
    savedSchedules: schedulesCountResult.count ?? 0,
    coursesReviewed: (courseReviewsResult.count ?? 0) + (professorReviewsResult.count ?? 0),
    friendCount: friendIds.length,
    friendsOnline,
  };
}

export async function getUpcomingEvents() {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('events')
    .select('id, title, type, starts_at, ends_at, description, location, term_id')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getActivity(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<unknown>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('activities')
    .select('id, actor_id, type, message, data, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(data ?? [], count ?? 0, pagination);
}
