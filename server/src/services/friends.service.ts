import { requireSupabaseClient } from '../db/supabase.js';
import type { Friendship } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { parseDays, parseMinutes } from './schedules.service.js';
import { trackActivity } from './activity.service.js';

export type FriendRequestDirection = 'incoming' | 'outgoing';

type UserProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  major: string | null;
  level: string | null;
  presence_status: string;
  last_seen_at: string | null;
};

type SectionTime = { days: string | null; start_time: string | null; end_time: string | null };
type ScheduleSectionTimeRow = {
  schedule_id: number;
  sections: SectionTime | SectionTime[] | null;
};

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

const FRIENDSHIP_COLUMNS = 'id, user_id, friend_id, status, created_at';
const PROFILE_COLUMNS = 'id, first_name, last_name, major, level, presence_status, last_seen_at';

const START_HOUR = 7;
const END_HOUR = 21;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);

function friendProfile(user: UserProfileRow) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    major: user.major,
    level: user.level,
    presenceStatus: user.presence_status,
    lastSeenAt: user.last_seen_at,
  };
}

async function getProfilesByUserId(userIds: string[]): Promise<Map<string, UserProfileRow>> {
  const ids = [...new Set(userIds)];

  if (ids.length === 0) {
    return new Map();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db.from('users').select(PROFILE_COLUMNS).in('id', ids);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((user) => [(user as UserProfileRow).id, user as UserProfileRow]));
}

async function assertUserExists(userId: string): Promise<void> {
  const db = requireSupabaseClient();
  const { data, error } = await db.from('users').select('id').eq('id', userId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  }
}

async function getFriendshipBetween(userIdA: string, userIdB: string): Promise<Friendship | null> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .or(
      `and(user_id.eq.${userIdA},friend_id.eq.${userIdB}),and(user_id.eq.${userIdB},friend_id.eq.${userIdA})`,
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Friendship | null;
}

async function updateFriendshipStatus(
  friendshipId: number,
  status: Friendship['status'],
): Promise<Friendship> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('friendships')
    .update({ status })
    .eq('id', friendshipId)
    .select(FRIENDSHIP_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data as Friendship;
}

export async function listFriends(userId: string) {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) {
    throw error;
  }

  const friendships = (data ?? []) as Friendship[];
  const friendIds = friendships.map((friendship) =>
    friendship.user_id === userId ? friendship.friend_id : friendship.user_id,
  );
  const profilesByUserId = await getProfilesByUserId(friendIds);

  return friendships.flatMap((friendship) => {
    const friendId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
    const profile = profilesByUserId.get(friendId);

    if (!profile) {
      return [];
    }

    return [{ ...friendProfile(profile), friendsSince: friendship.created_at }];
  });
}

export async function getSuggestedFriends(userId: string, limit: number) {
  const db = requireSupabaseClient();
  const [{ data: relationships, error: relationshipsError }, { data: viewer, error: viewerError }] =
    await Promise.all([
      db
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
      db.from('users').select('major').eq('id', userId).maybeSingle(),
    ]);

  if (relationshipsError) {
    throw relationshipsError;
  }

  if (viewerError) {
    throw viewerError;
  }

  const excludedIds = new Set<string>([userId]);

  for (const relationship of (relationships ?? []) as { user_id: string; friend_id: string }[]) {
    excludedIds.add(
      relationship.user_id === userId ? relationship.friend_id : relationship.user_id,
    );
  }

  const { data, error } = await db
    .from('users')
    .select(PROFILE_COLUMNS)
    .not('id', 'in', `(${[...excludedIds].join(',')})`);

  if (error) {
    throw error;
  }

  const viewerMajor = (viewer as { major: string | null } | null)?.major ?? null;
  const candidates = (data ?? []) as UserProfileRow[];

  candidates.sort((first, second) => {
    const firstMatches = viewerMajor !== null && first.major === viewerMajor ? 0 : 1;
    const secondMatches = viewerMajor !== null && second.major === viewerMajor ? 0 : 1;

    if (firstMatches !== secondMatches) {
      return firstMatches - secondMatches;
    }

    return (first.last_name ?? '').localeCompare(second.last_name ?? '');
  });

  return candidates.slice(0, limit).map(friendProfile);
}

export async function getFriendRequests(userId: string) {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .eq('status', 'pending')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error) {
    throw error;
  }

  const requests = (data ?? []) as Friendship[];
  const otherUserIds = requests.map((request) =>
    request.user_id === userId ? request.friend_id : request.user_id,
  );
  const profilesByUserId = await getProfilesByUserId(otherUserIds);

  const build = (direction: FriendRequestDirection) =>
    requests.flatMap((request) => {
      const isIncoming = request.friend_id === userId;

      if ((direction === 'incoming') !== isIncoming) {
        return [];
      }

      const otherUserId = isIncoming ? request.user_id : request.friend_id;
      const profile = profilesByUserId.get(otherUserId);

      if (!profile) {
        return [];
      }

      return [{ id: request.id, createdAt: request.created_at, user: friendProfile(profile) }];
    });

  return { incoming: build('incoming'), outgoing: build('outgoing') };
}

export async function sendFriendRequest(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new AppError(400, 'CANNOT_FRIEND_SELF', 'You cannot send a friend request to yourself.');
  }

  await assertUserExists(targetUserId);

  const db = requireSupabaseClient();
  const existing = await getFriendshipBetween(userId, targetUserId);

  if (existing) {
    if (existing.status === 'accepted') {
      throw new AppError(409, 'ALREADY_FRIENDS', 'You are already friends with this user.');
    }

    if (existing.status === 'pending') {
      if (existing.user_id === userId) {
        throw new AppError(409, 'REQUEST_ALREADY_SENT', 'A friend request is already pending.');
      }

      // The target already requested us — accept it instead of creating a duplicate row.
      const accepted = await updateFriendshipStatus(existing.id, 'accepted');
      await trackActivity(userId, 'friend_request_accepted', 'You are now friends.', {
        friendId: targetUserId,
      });

      return { id: accepted.id, status: accepted.status, createdAt: accepted.created_at };
    }

    const { error: deleteError } = await db.from('friendships').delete().eq('id', existing.id);

    if (deleteError) {
      throw deleteError;
    }
  }

  const { data, error } = await db
    .from('friendships')
    .insert({ user_id: userId, friend_id: targetUserId, status: 'pending' })
    .select(FRIENDSHIP_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const created = data as Friendship;
  await trackActivity(userId, 'friend_request_sent', 'You sent a friend request.', {
    friendId: targetUserId,
  });

  return { id: created.id, status: created.status, createdAt: created.created_at };
}

async function getIncomingPendingRequestOrThrow(
  userId: string,
  requesterId: string,
): Promise<Friendship> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .eq('user_id', requesterId)
    .eq('friend_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'FRIEND_REQUEST_NOT_FOUND', 'Friend request not found.');
  }

  return data as Friendship;
}

export async function acceptFriendRequest(userId: string, requesterId: string) {
  const request = await getIncomingPendingRequestOrThrow(userId, requesterId);
  await updateFriendshipStatus(request.id, 'accepted');
  await trackActivity(userId, 'friend_request_accepted', 'You are now friends.', {
    friendId: requesterId,
  });

  const profilesByUserId = await getProfilesByUserId([requesterId]);
  const profile = profilesByUserId.get(requesterId);

  return {
    ...(profile ? friendProfile(profile) : { id: requesterId }),
    friendsSince: request.created_at,
  };
}

export async function rejectFriendRequest(userId: string, requesterId: string): Promise<void> {
  const request = await getIncomingPendingRequestOrThrow(userId, requesterId);
  await updateFriendshipStatus(request.id, 'rejected');
}

export async function removeFriend(userId: string, targetUserId: string): Promise<void> {
  const existing = await getFriendshipBetween(userId, targetUserId);

  if (!existing) {
    throw new AppError(404, 'FRIENDSHIP_NOT_FOUND', 'Friendship not found.');
  }

  const db = requireSupabaseClient();
  const { error } = await db.from('friendships').delete().eq('id', existing.id);

  if (error) {
    throw error;
  }
}

async function getBusyBlocksByUser(
  userIds: string[],
): Promise<Map<string, { days: number[]; startMinutes: number; endMinutes: number }[]>> {
  const busyByUser = new Map<
    string,
    { days: number[]; startMinutes: number; endMinutes: number }[]
  >();

  if (userIds.length === 0) {
    return busyByUser;
  }

  const db = requireSupabaseClient();
  const { data: schedules, error: schedulesError } = await db
    .from('schedules')
    .select('id, user_id, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  if (schedulesError) {
    throw schedulesError;
  }

  const latestScheduleIdByUser = new Map<string, number>();

  for (const schedule of (schedules ?? []) as { id: number; user_id: string }[]) {
    if (!latestScheduleIdByUser.has(schedule.user_id)) {
      latestScheduleIdByUser.set(schedule.user_id, schedule.id);
    }
  }

  const scheduleIds = [...latestScheduleIdByUser.values()];

  if (scheduleIds.length === 0) {
    return busyByUser;
  }

  const { data: sectionRows, error: sectionsError } = await db
    .from('schedule_sections')
    .select('schedule_id, sections(days, start_time, end_time)')
    .in('schedule_id', scheduleIds);

  if (sectionsError) {
    throw sectionsError;
  }

  const scheduleIdByUser = new Map(
    [...latestScheduleIdByUser.entries()].map(([user, scheduleId]) => [scheduleId, user]),
  );

  for (const row of (sectionRows ?? []) as ScheduleSectionTimeRow[]) {
    const userId = scheduleIdByUser.get(row.schedule_id);
    const section = toOne(row.sections);

    if (!userId || !section) {
      continue;
    }

    const startMinutes = parseMinutes(section.start_time);
    const endMinutes = parseMinutes(section.end_time);

    if (startMinutes === null || endMinutes === null) {
      continue;
    }

    const blocks = busyByUser.get(userId) ?? [];
    blocks.push({ days: parseDays(section.days), startMinutes, endMinutes });
    busyByUser.set(userId, blocks);
  }

  return busyByUser;
}

function isBusyAt(
  blocks: { days: number[]; startMinutes: number; endMinutes: number }[],
  day: number,
  hour: number,
): boolean {
  const slotStart = hour * 60;
  const slotEnd = slotStart + 60;

  return blocks.some(
    (block) =>
      block.days.includes(day) && block.startMinutes < slotEnd && slotStart < block.endMinutes,
  );
}

export async function getCommonFreeTime(userId: string) {
  const friends = await listFriends(userId);
  const friendIds = friends.map((friend) => friend.id);
  const participantIds = [userId, ...friendIds];
  const busyByUser = await getBusyBlocksByUser(participantIds);
  const totalParticipants = participantIds.length;

  const days = DAY_LABELS.map((label, day) => {
    const freeCounts = HOURS.map(
      (hour) =>
        participantIds.filter(
          (participant) => !isBusyAt(busyByUser.get(participant) ?? [], day, hour),
        ).length,
    );
    const freePercentage = Math.round(
      (freeCounts.reduce((sum, count) => sum + count, 0) / (totalParticipants * HOURS.length)) *
        100,
    );

    return { day, label, freePercentage, freeCounts };
  });

  const commonFreeSlots = days.flatMap(({ day, label, freeCounts }) => {
    const slots: { day: number; label: string; startHour: number; endHour: number }[] = [];
    let rangeStart: number | null = null;

    HOURS.forEach((hour, index) => {
      const isFullyFree = freeCounts[index] === totalParticipants;

      if (isFullyFree && rangeStart === null) {
        rangeStart = hour;
      }

      const isLastHour = index === HOURS.length - 1;

      if ((!isFullyFree || isLastHour) && rangeStart !== null) {
        const endHour = isFullyFree && isLastHour ? hour + 1 : hour;
        slots.push({ day, label, startHour: rangeStart, endHour });
        rangeStart = null;
      }
    });

    return slots;
  });

  return {
    friendCount: friendIds.length,
    days: days.map(({ day, label, freePercentage }) => ({ day, label, freePercentage })),
    commonFreeSlots,
  };
}
