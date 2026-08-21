import { requireSupabaseClient } from '../db/supabase.js';
import type { StudyGroup } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type CreateStudyGroupInput = {
  name: string;
  courseCode?: string;
  description?: string;
  meetingTime?: string;
  location?: string;
  maxMembers?: number;
};

type StudyGroupRow = StudyGroup & { users: User | User[] | null };

export type StudyGroupSummary = {
  id: number;
  name: string;
  courseCode: string | null;
  description: string | null;
  meetingTime: string | null;
  location: string | null;
  host: { id: string; firstName: string | null; lastName: string | null } | null;
  maxMembers: number | null;
  memberCount: number;
  joined: boolean;
  createdAt: string;
};

function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

const GROUP_COLUMNS =
  'id, name, course_code, description, meeting_time, location, host_user_id, max_members, created_at';

const GROUP_WITH_HOST = `id, name, course_code, description, meeting_time, location, host_user_id, max_members, created_at, users!study_groups_host_user_id_fkey(id, first_name, last_name)`;

function toSummary(group: StudyGroupRow, memberCount: number, joined: boolean): StudyGroupSummary {
  const host = toOne(group.users);
  return {
    id: group.id,
    name: group.name,
    courseCode: group.course_code,
    description: group.description,
    meetingTime: group.meeting_time,
    location: group.location,
    host: host ? { id: host.id, firstName: host.first_name, lastName: host.last_name } : null,
    maxMembers: group.max_members,
    memberCount,
    joined,
    createdAt: group.created_at,
  };
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

export async function listStudyGroups(
  pagination: OffsetPagination,
  userId?: string,
): Promise<OffsetPage<StudyGroupSummary>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('study_groups')
    .select(GROUP_WITH_HOST, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  const groups = (data ?? []) as StudyGroupRow[];
  const groupIds = groups.map((g) => g.id);
  const memberCounts = await getMemberCounts(groupIds);
  const userMemberships = userId ? await getUserMemberships(groupIds, userId) : new Set<number>();

  return createOffsetPage(
    groups.map((group) =>
      toSummary(group, memberCounts.get(group.id) ?? 1, userMemberships.has(group.id)),
    ),
    count ?? 0,
    pagination,
  );
}

export async function getStudyGroup(id: number, userId?: string): Promise<StudyGroupSummary> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_groups')
    .select(GROUP_WITH_HOST)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'STUDY_GROUP_NOT_FOUND', 'Study group not found.');
  }

  const group = data as StudyGroupRow;
  const memberCounts = await getMemberCounts([id]);
  const userMemberships = userId ? await getUserMemberships([id], userId) : new Set<number>();

  return toSummary(group, memberCounts.get(id) ?? 1, userMemberships.has(id));
}

export async function createStudyGroup(
  userId: string,
  input: CreateStudyGroupInput,
): Promise<StudyGroupSummary> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('study_groups')
    .insert({
      name: input.name,
      course_code: input.courseCode ?? null,
      description: input.description ?? null,
      meeting_time: input.meetingTime ?? null,
      location: input.location ?? null,
      host_user_id: userId,
      max_members: input.maxMembers ?? null,
    })
    .select(GROUP_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const group = data as StudyGroup;

  // Host auto-joins
  await db
    .from('study_group_members')
    .insert({ study_group_id: group.id, user_id: userId })
    .select();

  return getStudyGroup(group.id, userId);
}

export async function joinStudyGroup(userId: string, groupId: number): Promise<void> {
  const db = requireSupabaseClient();
  const group = await getStudyGroup(groupId);

  if (group.maxMembers !== null && group.memberCount >= group.maxMembers) {
    throw new AppError(409, 'GROUP_FULL', 'This study group is full.');
  }

  const { error } = await db
    .from('study_group_members')
    .insert({ study_group_id: groupId, user_id: userId });

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'ALREADY_JOINED', 'You are already in this study group.');
    }
    throw error;
  }
}

export async function leaveStudyGroup(userId: string, groupId: number): Promise<void> {
  const db = requireSupabaseClient();
  const group = await getStudyGroup(groupId);

  if (group.host?.id === userId) {
    throw new AppError(
      400,
      'HOST_CANNOT_LEAVE',
      'The host cannot leave the group. Transfer ownership or delete it.',
    );
  }

  const { error, count } = await db
    .from('study_group_members')
    .delete()
    .eq('study_group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  if (!count) {
    throw new AppError(404, 'NOT_A_MEMBER', 'You are not a member of this group.');
  }
}
