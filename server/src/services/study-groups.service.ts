import { requireSupabaseClient } from '../db/supabase.js';
import type {
  Course,
  StudyGroup,
  StudyGroupJoinRequest,
  StudyGroupMember,
  StudyGroupMessage,
  User,
} from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';
import { trackActivity } from './activity.service.js';

export type CreateStudyGroupInput = {
  name: string;
  courseId: number;
  bio?: string;
  meetingDays?: number[];
  startTime?: string | null;
  endTime?: string | null;
};

export type StudyGroupMeeting = {
  days: number[];
  startTime: string | null;
  endTime: string | null;
};

export type StudyGroupSummary = {
  id: number;
  name: string;
  course: { id: number; code: string; title: string } | null;
  bio: string | null;
  owner: { id: string; firstName: string | null; lastName: string | null } | null;
  memberCount: number;
  createdAt: string;
  meeting: StudyGroupMeeting | null;
  /** Current user's relationship: owner, member, pending (join request), or none. */
  role: 'owner' | 'member' | 'pending' | 'none';
  joined: boolean;
  requested: boolean;
  /** Number of pending join requests. Only populated for the group owner. */
  pendingRequestCount?: number;
};

export type StudyGroupMemberInfo = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  joinedAt: string | null;
};

export type StudyGroupDetail = StudyGroupSummary & {
  members: StudyGroupMemberInfo[];
};

export type JoinRequestInfo = {
  userId: string;
  user: { id: string; firstName: string | null; lastName: string | null } | null;
  createdAt: string;
};

export type StudyGroupMessageInfo = {
  id: number;
  studyGroupId: number;
  sender: { id: string; firstName: string | null; lastName: string | null } | null;
  content: string;
  createdAt: string;
};

type GroupWithJoins = StudyGroup & {
  users: User | User[] | null;
  courses: Course | Course[] | null;
};

type MemberWithUser = StudyGroupMember & { users: User | User[] | null };

const GROUP_COLUMNS =
  'id, name, course_id, description, meeting_days, start_time, end_time, host_user_id, created_at';

const GROUP_WITH_JOINS = `id, name, course_id, description, meeting_days, start_time, end_time, host_user_id, created_at, users!study_groups_host_user_id_fkey(id, first_name, last_name), courses(id, title, subject, course_number)`;

const MEMBER_WITH_USER =
  'study_group_id, user_id, joined_at, users!study_group_members_user_id_fkey(id, first_name, last_name)';

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function courseCode(course: Course | null): string {
  if (!course || !course.subject) {
    return '';
  }
  return `${course.subject} ${course.course_number ?? ''}`.trim();
}

export type StudyGroupStatus = StudyGroupSummary['role'];

function statusFor(group: GroupWithJoins, isMember: boolean, hasPendingRequest: boolean, userId?: string): {
  role: StudyGroupStatus;
  joined: boolean;
  requested: boolean;
} {
  if (!userId) {
    return { role: 'none', joined: false, requested: false };
  }

  if (group.host_user_id === userId) {
    return { role: 'owner', joined: true, requested: false };
  }

  if (isMember) {
    return { role: 'member', joined: true, requested: false };
  }

  if (hasPendingRequest) {
    return { role: 'pending', joined: false, requested: true };
  }

  return { role: 'none', joined: false, requested: false };
}

function toSummary(
  group: GroupWithJoins,
  memberCount: number,
  status: ReturnType<typeof statusFor>,
  options: { pendingRequestCount?: number } = {},
): StudyGroupSummary {
  const owner = toOne(group.users);
  const course = toOne(group.courses);
  const hasMeeting =
    Array.isArray(group.meeting_days) && group.meeting_days.length > 0;

  const summary: StudyGroupSummary = {
    id: group.id,
    name: group.name,
    course: course ? { id: course.id, code: courseCode(course), title: course.title } : null,
    bio: group.description,
    owner: owner ? { id: owner.id, firstName: owner.first_name, lastName: owner.last_name } : null,
    memberCount,
    createdAt: group.created_at,
    meeting: hasMeeting
      ? {
          days: group.meeting_days ?? [],
          startTime: group.start_time ?? null,
          endTime: group.end_time ?? null,
        }
      : null,
    role: status.role,
    joined: status.joined,
    requested: status.requested,
  };

  if (status.role === 'owner') {
    summary.pendingRequestCount = options.pendingRequestCount ?? 0;
  }

  return summary;
}

async function getMemberCounts(groupIds: number[]): Promise<Map<number, number>> {
  if (groupIds.length === 0) {
    return new Map();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_members')
    .select('study_group_id')
    .in('study_group_id', groupIds);

  if (error) {
    throw error;
  }

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.study_group_id as number, (counts.get(row.study_group_id as number) ?? 0) + 1);
  }
  return counts;
}

async function getUserMemberships(groupIds: number[], userId: string): Promise<Set<number>> {
  if (groupIds.length === 0) {
    return new Set();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_members')
    .select('study_group_id')
    .in('study_group_id', groupIds)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.study_group_id as number));
}

async function getUserPendingRequests(groupIds: number[], userId: string): Promise<Set<number>> {
  if (groupIds.length === 0) {
    return new Set();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_join_requests')
    .select('study_group_id')
    .in('study_group_id', groupIds)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.study_group_id as number));
}

async function getPendingRequestCounts(groupIds: number[]): Promise<Map<number, number>> {
  if (groupIds.length === 0) {
    return new Map();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_join_requests')
    .select('study_group_id')
    .in('study_group_id', groupIds);

  if (error) {
    throw error;
  }

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.study_group_id as number, (counts.get(row.study_group_id as number) ?? 0) + 1);
  }
  return counts;
}

async function buildSummaries(
  groups: GroupWithJoins[],
  userId?: string,
): Promise<StudyGroupSummary[]> {
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((g) => g.id);
  const [memberCounts, memberships, pendingRequests, pendingRequestCounts] = await Promise.all([
    getMemberCounts(groupIds),
    userId ? getUserMemberships(groupIds, userId) : Promise.resolve(new Set<number>()),
    userId ? getUserPendingRequests(groupIds, userId) : Promise.resolve(new Set<number>()),
    getPendingRequestCounts(groupIds),
  ]);

  return groups.map((group) => {
    const memberCount = memberCounts.get(group.id) ?? 0;
    const status = statusFor(
      group,
      memberships.has(group.id),
      pendingRequests.has(group.id),
      userId,
    );
    return toSummary(group, memberCount, status, {
      pendingRequestCount: pendingRequestCounts.get(group.id) ?? 0,
    });
  });
}

export async function listStudyGroups(
  pagination: OffsetPagination,
  userId?: string,
): Promise<OffsetPage<StudyGroupSummary>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('study_groups')
    .select(GROUP_WITH_JOINS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  const groups = (data ?? []) as GroupWithJoins[];
  const summaries = await buildSummaries(groups, userId);

  return createOffsetPage(summaries, count ?? 0, pagination);
}

export async function listMyStudyGroups(
  userId: string,
  pagination: OffsetPagination,
): Promise<OffsetPage<StudyGroupSummary>> {
  const db = requireSupabaseClient();

  const [{ data: ownedData, error: ownedError }, { data: memberData, error: memberError }] =
    await Promise.all([
      db
        .from('study_groups')
        .select('id')
        .eq('host_user_id', userId)
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1),
      db
        .from('study_group_members')
        .select('study_group_id')
        .eq('user_id', userId),
    ]);

  if (ownedError) throw ownedError;
  if (memberError) throw memberError;

  // Owned groups are added to every membership-derived id so owners appear in
  // "My Study Groups" even when their membership row is missing.
  const ownedIds = (ownedData ?? []).map((row) => row.id as number);
  const memberIds = new Set<number>(ownedIds);
  for (const row of memberData ?? []) {
    memberIds.add(row.study_group_id as number);
  }

  const ids = [...memberIds];
  const groups = await getGroupsByIds(ids);
  const summaries = await buildSummaries(groups, userId);

  return createOffsetPage(summaries, ids.length, pagination);
}

async function getGroupsByIds(ids: number[]): Promise<GroupWithJoins[]> {
  if (ids.length === 0) {
    return [];
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_groups')
    .select(GROUP_WITH_JOINS)
    .in('id', ids)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const byId = new Map((data ?? []).map((row) => [row.id as number, row as GroupWithJoins]));
  return ids.flatMap((id) => (byId.has(id) ? [(byId.get(id) as GroupWithJoins)] : []));
}

export async function getStudyGroup(id: number, userId?: string): Promise<StudyGroupDetail> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_groups')
    .select(GROUP_WITH_JOINS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'STUDY_GROUP_NOT_FOUND', 'Study group not found.');
  }

  const group = data as GroupWithJoins;
  const summaries = await buildSummaries([group], userId);
  const summary = summaries[0]!;

  const { data: memberRows, error: memberError } = await db
    .from('study_group_members')
    .select(MEMBER_WITH_USER)
    .eq('study_group_id', id);

  if (memberError) {
    throw memberError;
  }

  const members: StudyGroupMemberInfo[] = ((memberRows ?? []) as MemberWithUser[]).map((member) => {
    const user = toOne(member.users);
    return {
      id: user?.id ?? member.user_id,
      firstName: user?.first_name ?? null,
      lastName: user?.last_name ?? null,
      joinedAt: member.joined_at ?? null,
    };
  });

  return { ...summary, members };
}

async function getCourseOrThrow(courseId: number): Promise<Course> {
  const db = requireSupabaseClient();
  const { data, error } = await db.from('courses').select('id, title, subject, course_number').eq('id', courseId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'COURSE_NOT_FOUND', 'The selected course does not exist.');
  }

  return data as Course;
}

export async function createStudyGroup(
  userId: string,
  input: CreateStudyGroupInput,
): Promise<StudyGroupDetail> {
  const db = requireSupabaseClient();
  const course = await getCourseOrThrow(input.courseId);

  const { data, error } = await db
    .from('study_groups')
    .insert({
      name: input.name,
      course_id: course.id,
      description: input.bio ?? null,
      meeting_days: input.meetingDays?.length ? input.meetingDays : null,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      host_user_id: userId,
    })
    .select(GROUP_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const group = data as StudyGroup;

  // The owner becomes the first member automatically.
  const { error: memberError } = await db
    .from('study_group_members')
    .insert({ study_group_id: group.id, user_id: userId });

  if (memberError) {
    throw memberError;
  }

  await trackActivity(userId, 'study_group_created', `You created the study group "${input.name}".`, {
    studyGroupId: group.id,
  });

  return getStudyGroup(group.id, userId);
}

export async function requestToJoin(userId: string, groupId: number): Promise<void> {
  const db = requireSupabaseClient();
  const group = await getStudyGroup(groupId, userId);

  if (group.owner?.id === userId) {
    throw new AppError(400, 'OWNER_CANNOT_REQUEST', 'You are the owner of this study group.');
  }

  if (group.joined) {
    throw new AppError(409, 'ALREADY_MEMBER', 'You are already a member of this study group.');
  }

  if (group.requested) {
    throw new AppError(409, 'REQUEST_ALREADY_SENT', 'You have already requested to join this group.');
  }

  const { error } = await db
    .from('study_group_join_requests')
    .insert({ study_group_id: groupId, user_id: userId });

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'REQUEST_ALREADY_SENT', 'You have already requested to join this group.');
    }
    throw error;
  }

  await trackActivity(userId, 'study_group_join_requested', `You requested to join "${group.name}".`, {
    studyGroupId: groupId,
  });

  if (group.owner?.id) {
    await trackActivity(
      group.owner.id,
      'study_group_request_received',
      `A student requested to join "${group.name}".`,
      { studyGroupId: groupId },
    );
  }
}

export async function cancelJoinRequest(userId: string, groupId: number): Promise<void> {
  const db = requireSupabaseClient();

  // Throws 404 when the group does not exist.
  const group = await getStudyGroup(groupId);

  const { error, count } = await db
    .from('study_group_join_requests')
    .delete()
    .eq('study_group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new AppError(404, 'REQUEST_NOT_FOUND', 'No pending join request exists for this group.');
  }

  if (group.owner?.id) {
    await trackActivity(
      group.owner.id,
      'study_group_request_cancelled',
      `A student cancelled their request to join "${group.name}".`,
      { studyGroupId: groupId },
    );
  }
}

async function assertIsOwner(userId: string, groupId: number): Promise<GroupWithJoins> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_groups')
    .select('id, name, host_user_id')
    .eq('id', groupId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'STUDY_GROUP_NOT_FOUND', 'Study group not found.');
  }

  if (data.host_user_id !== userId) {
    throw new AppError(
      403,
      'NOT_OWNER',
      'Only the study group owner can manage this study group.',
    );
  }

  return data as GroupWithJoins;
}

async function getPendingRequestOrThrow(
  groupId: number,
  requesterId: string,
): Promise<StudyGroupJoinRequest> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_join_requests')
    .select('study_group_id, user_id, created_at')
    .eq('study_group_id', groupId)
    .eq('user_id', requesterId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'REQUEST_NOT_FOUND', 'No pending join request exists for this student.');
  }

  return data as StudyGroupJoinRequest;
}

export async function acceptJoinRequest(
  ownerId: string,
  groupId: number,
  requesterId: string,
): Promise<void> {
  const db = requireSupabaseClient();
  const group = await assertIsOwner(ownerId, groupId);
  await getPendingRequestOrThrow(groupId, requesterId);

  // Remove the request and add the student as a member.
  const { error: deleteError } = await db
    .from('study_group_join_requests')
    .delete()
    .eq('study_group_id', groupId)
    .eq('user_id', requesterId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: memberError } = await db
    .from('study_group_members')
    .insert({ study_group_id: groupId, user_id: requesterId });

  if (memberError) {
    if (memberError.code === '23505') {
      throw new AppError(409, 'ALREADY_MEMBER', 'This student is already a member of the group.');
    }
    throw memberError;
  }

  await trackActivity(requesterId, 'study_group_join_accepted', `You joined "${group.name}".`, {
    studyGroupId: groupId,
  });
}

export async function rejectJoinRequest(
  ownerId: string,
  groupId: number,
  requesterId: string,
): Promise<void> {
  const db = requireSupabaseClient();
  const group = await assertIsOwner(ownerId, groupId);
  await getPendingRequestOrThrow(groupId, requesterId);

  const { error } = await db
    .from('study_group_join_requests')
    .delete()
    .eq('study_group_id', groupId)
    .eq('user_id', requesterId);

  if (error) {
    throw error;
  }

  await trackActivity(requesterId, 'study_group_request_rejected', `Your request to join "${group.name}" was declined.`, {
    studyGroupId: groupId,
  });
}

export async function listJoinRequests(
  ownerId: string,
  groupId: number,
): Promise<JoinRequestInfo[]> {
  const db = requireSupabaseClient();
  await assertIsOwner(ownerId, groupId);

  const { data, error } = await db
    .from('study_group_join_requests')
    .select('user_id, created_at')
    .eq('study_group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Pick<StudyGroupJoinRequest, 'user_id' | 'created_at'>[];
  const requesterIds = rows.map((row) => row.user_id);

  let profilesByUserId = new Map<string, User>();
  if (requesterIds.length > 0) {
    const { data: profiles, error: profileError } = await db
      .from('users')
      .select('id, first_name, last_name')
      .in('id', requesterIds);

    if (profileError) {
      throw profileError;
    }

    profilesByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile as User]));
  }

  return rows.map((row) => {
    const user = profilesByUserId.get(row.user_id);
    return {
      userId: row.user_id,
      user: user ? { id: user.id, firstName: user.first_name, lastName: user.last_name } : null,
      createdAt: row.created_at,
    };
  });
}

export async function getStudyGroupOrThrow(id: number): Promise<GroupWithJoins> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_groups')
    .select('id, name, host_user_id')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'STUDY_GROUP_NOT_FOUND', 'Study group not found.');
  }

  return data as GroupWithJoins;
}

async function assertIsMember(userId: string, groupId: number): Promise<void> {
  const group = await getStudyGroupOrThrow(groupId);

  // The owner is always considered a member and has full chat access, even if
  // their membership row is absent (which avoids depending on seed data).
  if (group.host_user_id === userId) {
    return;
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_members')
    .select('user_id')
    .eq('study_group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(
      403,
      'NOT_MEMBER',
      'You must be a member of this study group to access its chat.',
    );
  }
}

/** Number of calendar days returned per chat-history page. */
const CHAT_HISTORY_WINDOW_DAYS = 15;

/** Default/maximum number of messages returned per chat-history page. */
const CHAT_HISTORY_DEFAULT_LIMIT = 200;
const CHAT_HISTORY_MAX_LIMIT = 500;

export type ChatHistoryPage = {
  data: StudyGroupMessageInfo[];
  /** True when there are older messages beyond the returned window. */
  hasMore: boolean;
  /** ISO timestamp to pass as `before` to fetch the next older window, or null. */
  nextCursor: string | null;
};

export type ChatHistoryQuery = {
  /** Exclusive upper bound (ISO timestamp). Defaults to the current time. */
  before?: string;
  limit?: number;
};

export async function listStudyGroupMessages(
  userId: string,
  groupId: number,
  query: ChatHistoryQuery = {},
): Promise<ChatHistoryPage> {
  await assertIsMember(userId, groupId);

  const limit = Math.min(
    Math.max(query.limit ?? CHAT_HISTORY_DEFAULT_LIMIT, 1),
    CHAT_HISTORY_MAX_LIMIT,
  );
  const beforeMs = Date.parse(query.before ?? new Date().toISOString());
  const before = new Date(Number.isFinite(beforeMs) ? beforeMs : Date.now()).toISOString();
  const windowStart = new Date(Date.parse(before) - CHAT_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_messages')
    .select('id, study_group_id, sender_id, content, created_at')
    .eq('study_group_id', groupId)
    .gte('created_at', windowStart.toISOString())
    .lt('created_at', before)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as StudyGroupMessage[]; // already ascending

  // Determine whether history exists before this window so the client knows to
  // keep requesting older pages.
  const { count, error: moreError } = await db
    .from('study_group_messages')
    .select('id', { count: 'exact', head: true })
    .eq('study_group_id', groupId)
    .lt('created_at', windowStart.toISOString());
  if (moreError) {
    throw moreError;
  }

  const senderIds = [...new Set(rows.map((row) => row.sender_id))];

  let profilesByUserId: Map<string, User> = new Map<string, User>();
  if (senderIds.length > 0) {
    const { data: profiles, error: profileError } = await db
      .from('users')
      .select('id, first_name, last_name')
      .in('id', senderIds);

    if (profileError) {
      throw profileError;
    }

    profilesByUserId = new Map((profiles ?? []).map((profile) => [profile.id, profile as User]));
  }

  const messages = rows.map((row) => {
    const sender = profilesByUserId.get(row.sender_id);
    return {
      id: row.id,
      studyGroupId: row.study_group_id,
      sender: sender
        ? { id: sender.id, firstName: sender.first_name, lastName: sender.last_name }
        : null,
      content: row.content,
      createdAt: row.created_at,
    };
  });

  // nextCursor is the oldest returned message timestamp, or the window start so
  // the client can keep walking back through empty windows when hasMore is true.
  const oldest = rows[0]?.created_at;
  return {
    data: messages,
    hasMore: (count ?? 0) > 0,
    nextCursor: oldest ?? windowStart.toISOString(),
  };
}

export async function sendStudyGroupMessage(
  userId: string,
  groupId: number,
  content: string,
): Promise<StudyGroupMessageInfo> {
  await assertIsMember(userId, groupId);

  const trimmed = content.trim();
  if (!trimmed) {
    throw new AppError(400, 'EMPTY_MESSAGE', 'Message cannot be empty.');
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_group_messages')
    .insert({
      study_group_id: groupId,
      sender_id: userId,
      content: trimmed,
    })
    .select('id, study_group_id, sender_id, content, created_at')
    .single();

  if (error) {
    throw error;
  }

  const row = data as StudyGroupMessage;
  const user = await getUserById(userId);

  return {
    id: row.id,
    studyGroupId: row.study_group_id,
    sender: user ? { id: user.id, firstName: user.first_name, lastName: user.last_name } : null,
    content: row.content,
    createdAt: row.created_at,
  };
}

async function getUserById(id: string): Promise<User | null> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('users')
    .select('id, first_name, last_name')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as User) ?? null;
}

export async function updateStudyGroup(
  ownerId: string,
  groupId: number,
  input: CreateStudyGroupInput,
): Promise<StudyGroupDetail> {
  const db = requireSupabaseClient();
  await assertIsOwner(ownerId, groupId);
  const course = await getCourseOrThrow(input.courseId);

  const { error } = await db
    .from('study_groups')
    .update({
      name: input.name,
      course_id: course.id,
      description: input.bio ?? null,
      meeting_days: input.meetingDays?.length ? input.meetingDays : null,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
    })
    .eq('id', groupId);

  if (error) {
    throw error;
  }

  await trackActivity(ownerId, 'study_group_updated', `You updated the study group "${input.name}".`, {
    studyGroupId: groupId,
  });

  return getStudyGroup(groupId, ownerId);
}

export async function removeStudyGroupMember(
  ownerId: string,
  groupId: number,
  memberId: string,
): Promise<void> {
  const db = requireSupabaseClient();
  const group = await assertIsOwner(ownerId, groupId);

  if (memberId === ownerId) {
    throw new AppError(
      400,
      'CANNOT_REMOVE_OWNER',
      'You cannot remove yourself as the owner of a study group.',
    );
  }

  const { error, count } = await db
    .from('study_group_members')
    .delete()
    .eq('study_group_id', groupId)
    .eq('user_id', memberId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'That student is not a member of this group.');
  }

  await trackActivity(
    memberId,
    'study_group_member_removed',
    `You were removed from "${group.name}" by the group owner.`,
    { studyGroupId: groupId },
  );
}
