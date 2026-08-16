import { requireSupabaseClient } from '../db/supabase.js';
import type { Notification } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'post_liked'
  | 'post_commented'
  | 'review_liked'
  | 'schedule_shared'
  | 'registration_reminder';

const NOTIFICATION_COLUMNS = 'id, user_id, actor_id, type, message, data, read_at, created_at';

function notificationResponse(notification: Notification) {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    data: notification.data,
    actorId: notification.actor_id,
    isRead: notification.read_at !== null,
    readAt: notification.read_at,
    createdAt: notification.created_at,
  };
}

/**
 * Creates a notification for `userId`. Silently no-ops when the actor and the
 * recipient are the same person, so actions like liking your own post don't
 * notify you about yourself.
 */
export async function createNotification(
  userId: string,
  actorId: string | null,
  type: NotificationType,
  message: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (actorId !== null && actorId === userId) {
    return;
  }

  const db = requireSupabaseClient();
  const { error } = await db.from('notifications').insert({
    user_id: userId,
    actor_id: actorId,
    type,
    message,
    data,
  });

  if (error) {
    throw error;
  }
}

export async function listNotifications(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<ReturnType<typeof notificationResponse>>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('notifications')
    .select(NOTIFICATION_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  return createOffsetPage(
    (data ?? []).map((notification) => notificationResponse(notification as Notification)),
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
    .is('read_at', null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function markAsRead(userId: string, notificationId: number): Promise<void> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    throw error;
  }
}
