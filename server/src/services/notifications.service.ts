import { requireSupabaseClient } from '../db/supabase.js';
import type { Notification, NotificationPreference } from '../db/types.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type NotificationSettingsInput = Partial<{
  friendRequests: boolean;
  friendAcceptances: boolean;
  postLikes: boolean;
  postComments: boolean;
  reviewLikes: boolean;
  scheduleShares: boolean;
  registrationReminders: boolean;
}>;

type ActorProfile = { id: string; first_name: string | null; last_name: string | null };
type NotificationWithActor = Notification & { users: ActorProfile | ActorProfile[] | null };

const NOTIFICATION_COLUMNS = 'id, user_id, type, message, data, actor_id, read, created_at';

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function notificationResponse(row: NotificationWithActor) {
  const actor = toOne(row.users);
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    data: row.data,
    actor: actor ? { id: actor.id, firstName: actor.first_name, lastName: actor.last_name } : null,
    read: row.read,
    createdAt: row.created_at,
  };
}

export async function listNotifications(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReturnType<typeof notificationResponse>>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('notifications')
    .select(
      `${NOTIFICATION_COLUMNS}, users!notifications_actor_id_fkey(id, first_name, last_name)`,
      { count: 'exact' },
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(
    (data ?? []).map((row) => notificationResponse(row as NotificationWithActor)),
    count ?? 0,
    pagination,
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const db = requireSupabaseClient();
  const { count, error } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markAsRead(userId: string, notificationId: number): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    throw error;
  }
}

export async function getPreferences(userId: string): Promise<NotificationPreference> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data as NotificationPreference;
  }

  const defaults: NotificationPreference = {
    user_id: userId,
    friend_requests: true,
    friend_acceptances: true,
    post_likes: true,
    post_comments: true,
    review_likes: true,
    schedule_shares: true,
    registration_reminders: true,
  };

  return defaults;
}

export async function updatePreferences(
  userId: string,
  input: NotificationSettingsInput,
): Promise<NotificationPreference> {
  const db = requireSupabaseClient();
  const updates: Record<string, boolean> = {};

  if (input.friendRequests !== undefined) updates.friend_requests = input.friendRequests;
  if (input.friendAcceptances !== undefined) updates.friend_acceptances = input.friendAcceptances;
  if (input.postLikes !== undefined) updates.post_likes = input.postLikes;
  if (input.postComments !== undefined) updates.post_comments = input.postComments;
  if (input.reviewLikes !== undefined) updates.review_likes = input.reviewLikes;
  if (input.scheduleShares !== undefined) updates.schedule_shares = input.scheduleShares;
  if (input.registrationReminders !== undefined)
    updates.registration_reminders = input.registrationReminders;

  if (Object.keys(updates).length > 0) {
    const { error } = await db
      .from('notification_preferences')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });

    if (error) {
      throw error;
    }
  }

  return getPreferences(userId);
}

export async function createNotification(
  userId: string,
  type: string,
  message: string,
  actorId?: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db.from('notifications').insert({
    user_id: userId,
    type,
    message,
    actor_id: actorId ?? null,
    data,
  });

  if (error) {
    throw error;
  }
}

async function shouldNotify(
  userId: string,
  preferenceKey: keyof Omit<NotificationPreference, 'user_id'>,
): Promise<boolean> {
  const db = requireSupabaseClient();
  const { data } = await db
    .from('notification_preferences')
    .select(preferenceKey)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return true;
  }

  return (data as Record<string, unknown>)[preferenceKey] !== false;
}

export async function notifyFriendRequestReceived(
  targetUserId: string,
  actorId: string,
): Promise<void> {
  if (await shouldNotify(targetUserId, 'friend_requests')) {
    await createNotification(
      targetUserId,
      'friend_request_received',
      'sent you a friend request.',
      actorId,
    );
  }
}

export async function notifyFriendRequestAccepted(
  targetUserId: string,
  actorId: string,
): Promise<void> {
  if (await shouldNotify(targetUserId, 'friend_acceptances')) {
    await createNotification(
      targetUserId,
      'friend_request_accepted',
      'accepted your friend request.',
      actorId,
    );
  }
}

export async function notifyPostLiked(
  postOwnerId: string,
  actorId: string,
  postId: number,
): Promise<void> {
  if (await shouldNotify(postOwnerId, 'post_likes')) {
    await createNotification(postOwnerId, 'post_liked', 'liked your post.', actorId, { postId });
  }
}

export async function notifyPostCommented(
  postOwnerId: string,
  actorId: string,
  postId: number,
): Promise<void> {
  if (await shouldNotify(postOwnerId, 'post_comments')) {
    await createNotification(postOwnerId, 'post_commented', 'commented on your post.', actorId, {
      postId,
    });
  }
}

export async function notifyReviewLiked(
  reviewOwnerId: string,
  actorId: string,
  reviewId: number,
): Promise<void> {
  if (await shouldNotify(reviewOwnerId, 'review_likes')) {
    await createNotification(reviewOwnerId, 'review_liked', 'liked your review.', actorId, {
      reviewId,
    });
  }
}

export async function notifyScheduleShared(
  targetUserId: string,
  actorId: string,
  scheduleId: number,
): Promise<void> {
  if (await shouldNotify(targetUserId, 'schedule_shares')) {
    await createNotification(
      targetUserId,
      'schedule_shared',
      'shared a schedule with you.',
      actorId,
      { scheduleId },
    );
  }
}
