import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

const { trackActivity } = vi.hoisted(() => ({
  trackActivity: vi.fn(async () => undefined),
}));

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));
vi.mock('../../src/services/activity.service.js', () => ({ trackActivity }));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import {
  acceptJoinRequest,
  cancelJoinRequest,
  createStudyGroup,
  getStudyGroup,
  listJoinRequests,
  listMyStudyGroups,
  listStudyGroupMessages,
  listStudyGroups,
  rejectJoinRequest,
  removeStudyGroupMember,
  requestToJoin,
  sendStudyGroupMessage,
  updateStudyGroup,
} from '../../src/services/study-groups.service.js';

const A = 'owner-alice';
const B = 'member-bob';
const C = 'outsider-carol';
const D = 'outsider-dave';

const COURSE_1 = { id: 100, subject: 'CMPS', course_number: '214', title: 'Data Structures' };
const COURSE_2 = { id: 101, subject: 'MATH', course_number: '201', title: 'Calculus III' };

function userRow(id: string, firstName: string) {
  return { id, first_name: firstName, last_name: 'Tester' };
}

function groupRow(id: number, over: Row = {}): Row {
  return {
    id,
    name: `Study Group ${id}`,
    course_id: COURSE_1.id,
    description: `Description for group ${id}`,
    meeting_days: [1],
    start_time: '18:00:00',
    end_time: '19:00:00',
    host_user_id: A,
    created_at: `2026-01-0${id}T00:00:00Z`,
    users: userRow(A, 'Alice'),
    courses: COURSE_1,
    ...over,
  };
}

function memberRow(groupId: number, userId: string, firstName: string): Row {
  return {
    study_group_id: groupId,
    user_id: userId,
    joined_at: '2026-01-01T00:00:00Z',
    users: userRow(userId, firstName),
  };
}

function table(name: string): Row[] {
  return (fakeClient.value!.from(name).select('*') as unknown as { table: Row[] }).table;
}

function resetTables(over: Partial<Record<string, Row[]>> = {}) {
  fakeClient.value = createFakeSupabase({
    users: [userRow(A, 'Alice'), userRow(B, 'Bob'), userRow(C, 'Carol'), userRow(D, 'Dave')],
    courses: [COURSE_1, COURSE_2],
    study_groups: [
      groupRow(1),
      groupRow(2, { host_user_id: B, course_id: COURSE_2.id, users: userRow(B, 'Bob'), courses: COURSE_2 }),
    ],
    study_group_members: [
      memberRow(1, A, 'Alice'),
      memberRow(1, B, 'Bob'),
      memberRow(2, B, 'Bob'),
    ],
    study_group_join_requests: [],
    study_group_messages: [],
    ...over,
  });
}

function pagination() {
  return { page: 1, limit: 50, offset: 0 };
}

beforeEach(() => {
  trackActivity.mockClear();
  resetTables();
});

describe('createStudyGroup', () => {
  it('creates a group linked to an existing course and makes the creator the owner', async () => {
    await createStudyGroup(C, { name: 'New Group', courseId: COURSE_2.id, bio: 'Hello', meetingDays: [0, 2], startTime: '17:00:00', endTime: '18:30:00' });

    const groups = table('study_groups');
    const created = groups.find((group) => group.name === 'New Group')!;
    expect(created).toBeDefined();
    expect(created.course_id).toBe(COURSE_2.id);
    expect(created.host_user_id).toBe(C);
    expect(created.meeting_days).toEqual([0, 2]);
    expect(created.start_time).toBe('17:00:00');
    expect(created.end_time).toBe('18:30:00');
  });

  it('creates a group without a meeting time (to be announced)', async () => {
    await createStudyGroup(C, { name: 'No Time Group', courseId: COURSE_1.id, meetingDays: [1] });

    const created = table('study_groups').find((group) => group.name === 'No Time Group')!;
    expect(created.start_time).toBeNull();
    expect(created.end_time).toBeNull();
    expect(created.meeting_days).toEqual([1]);
  });

  it('throws when the course does not exist', async () => {
    await expect(
      createStudyGroup(C, { name: 'Bad', courseId: 999999 }),
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND', statusCode: 404 });
  });

  it('automatically adds the owner as the first member', async () => {
    await createStudyGroup(C, { name: 'Owner Group', courseId: COURSE_1.id });

    const memberships = table('study_group_members');
    const groups = table('study_groups');
    const created = groups.find((group) => group.name === 'Owner Group')! as Row;

    expect(
      memberships.some(
        (m) => m.study_group_id === created.id && m.user_id === C,
      ),
    ).toBe(true);
  });
});

describe('listStudyGroups (Explore)', () => {
  it('returns groups with course, owner, meeting info and correct member counts', async () => {
    const page = await listStudyGroups(pagination(), C);

    expect(page.data).toHaveLength(2);

    const group1 = page.data.find((g) => g.id === 1)!;
    expect(group1.course).toEqual({ id: 100, code: 'CMPS 214', title: 'Data Structures' });
    expect(group1.owner?.id).toBe(A);
    expect(group1.memberCount).toBe(2);
    expect(group1.meeting).toEqual({ days: [1], startTime: '18:00:00', endTime: '19:00:00' });
    expect(group1.createdAt).toBeDefined();
  });

  it('reports the caller relationship: none, pending, member, owner', async () => {
    // C is an outsider (none).
    const nonePage = await listStudyGroups(pagination(), C);
    const noneG1 = nonePage.data.find((g) => g.id === 1)!;
    expect(noneG1.role).toBe('none');
    expect(noneG1.joined).toBe(false);
    expect(noneG1.requested).toBe(false);

    // C requests to join group 1.
    await requestToJoin(C, 1);
    const pendingPage = await listStudyGroups(pagination(), C);
    expect(pendingPage.data.find((g) => g.id === 1)!.role).toBe('pending');
    expect(pendingPage.data.find((g) => g.id === 1)!.requested).toBe(true);

    // B is a member of group 1.
    const memberPage = await listStudyGroups(pagination(), B);
    expect(memberPage.data.find((g) => g.id === 1)!.role).toBe('member');
    expect(memberPage.data.find((g) => g.id === 1)!.joined).toBe(true);

    // A owns group 1.
    const ownerPage = await listStudyGroups(pagination(), A);
    expect(ownerPage.data.find((g) => g.id === 1)!.role).toBe('owner');
    expect(ownerPage.data.find((g) => g.id === 1)!.joined).toBe(true);
  });
});

describe('listMyStudyGroups', () => {
  it('returns groups the user owns or is a member of', async () => {
    const page = await listMyStudyGroups(B, pagination());
    const ids = page.data.map((g) => g.id).sort();
    // B owns group 2 and is a member of group 1.
    expect(ids).toEqual([1, 2]);
  });
});

describe('getStudyGroup (details)', () => {
  it('returns the group with owner, course, and member list', async () => {
    const detail = await getStudyGroup(1, C);

    expect(detail.name).toBe('Study Group 1');
    expect(detail.course?.code).toBe('CMPS 214');
    expect(detail.owner?.id).toBe(A);
    expect(detail.memberCount).toBe(2);
    expect(detail.members.map((m) => m.id).sort()).toEqual([A, B].sort());
  });

  it('throws 404 when the group does not exist', async () => {
    await expect(getStudyGroup(99999)).rejects.toMatchObject({
      code: 'STUDY_GROUP_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('requestToJoin', () => {
  it('lets an outsider request to join a group', async () => {
    await requestToJoin(C, 1);
    const requests = table('study_group_join_requests');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ study_group_id: 1, user_id: C });
  });

  it('rejects a duplicate pending request', async () => {
    await requestToJoin(C, 1);
    await expect(requestToJoin(C, 1)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_SENT',
      statusCode: 409,
    });
    expect(table('study_group_join_requests')).toHaveLength(1);
  });

  it('prevents an existing member from requesting to join again', async () => {
    await expect(requestToJoin(B, 1)).rejects.toMatchObject({
      code: 'ALREADY_MEMBER',
      statusCode: 409,
    });
  });

  it("prevents the owner from requesting to join their own group", async () => {
    await expect(requestToJoin(A, 1)).rejects.toMatchObject({
      code: 'OWNER_CANNOT_REQUEST',
      statusCode: 400,
    });
  });
});

describe('cancelJoinRequest', () => {
  it('removes a student own pending request', async () => {
    await requestToJoin(C, 1);
    await cancelJoinRequest(C, 1);
    expect(table('study_group_join_requests')).toHaveLength(0);
  });

  it('throws 404 when there is no pending request', async () => {
    await expect(cancelJoinRequest(C, 1)).rejects.toMatchObject({
      code: 'REQUEST_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('acceptJoinRequest', () => {
  it('lets the owner accept a request and creates a membership', async () => {
    await requestToJoin(C, 1);
    await acceptJoinRequest(A, 1, C);

    // Request is gone and a membership row now exists for C.
    expect(table('study_group_join_requests')).toHaveLength(0);
    expect(
      table('study_group_members').some((m) => m.study_group_id === 1 && m.user_id === C),
    ).toBe(true);
  });

  it('updates the member count after accepting', async () => {
    await requestToJoin(C, 1);
    expect((await getStudyGroup(1, A)).memberCount).toBe(2);

    await acceptJoinRequest(A, 1, C);

    const detail = await getStudyGroup(1, A);
    expect(detail.memberCount).toBe(3);
    expect(detail.members.map((m) => m.id).sort()).toEqual([A, B, C].sort());
  });

  it('rejects a non-owner trying to accept', async () => {
    await requestToJoin(D, 1);
    await expect(acceptJoinRequest(B, 1, D)).rejects.toMatchObject({
      code: 'NOT_OWNER',
      statusCode: 403,
    });
    // Request remains.
    expect(table('study_group_join_requests')).toHaveLength(1);
  });

  it('throws 404 when there is no pending request', async () => {
    await expect(acceptJoinRequest(A, 1, C)).rejects.toMatchObject({
      code: 'REQUEST_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('rejectJoinRequest', () => {
  it('lets the owner reject a request without creating a membership', async () => {
    await requestToJoin(C, 1);
    await rejectJoinRequest(A, 1, C);

    expect(table('study_group_join_requests')).toHaveLength(0);
    expect(
      table('study_group_members').some((m) => m.study_group_id === 1 && m.user_id === C),
    ).toBe(false);
  });

  it('rejects a non-owner trying to reject', async () => {
    await requestToJoin(C, 1);
    await expect(rejectJoinRequest(B, 1, C)).rejects.toMatchObject({
      code: 'NOT_OWNER',
      statusCode: 403,
    });
    expect(table('study_group_join_requests')).toHaveLength(1);
  });
});

describe('listJoinRequests', () => {
  it('returns pending requests with requester profiles for the owner', async () => {
    await requestToJoin(C, 1);
    await requestToJoin(D, 1);

    const requests = await listJoinRequests(A, 1);
    expect(requests.map((r) => r.userId).sort()).toEqual([C, D]);
    expect(requests[0].user?.firstName).toBeDefined();
  });

  it('forbids a non-owner from listing requests', async () => {
    await expect(listJoinRequests(C, 1)).rejects.toMatchObject({
      code: 'NOT_OWNER',
      statusCode: 403,
    });
  });
});

describe('pendingRequestCount (owner card indicator)', () => {
  it('exposes the pending request count to the owner but to no one else', async () => {
    await requestToJoin(C, 1);
    await requestToJoin(D, 1);

    // Owner sees the count.
    const ownerPage = await listStudyGroups(pagination(), A);
    expect(ownerPage.data.find((g) => g.id === 1)!.pendingRequestCount).toBe(2);

    // A non-owner (member) does not see the count at all.
    const memberPage = await listStudyGroups(pagination(), B);
    expect(memberPage.data.find((g) => g.id === 1)!.pendingRequestCount).toBeUndefined();

    // An outsider does not see the count either.
    const outsiderPage = await listStudyGroups(pagination(), C);
    expect(outsiderPage.data.find((g) => g.id === 1)!.pendingRequestCount).toBeUndefined();
  });

  it('updates the count after a request is accepted', async () => {
    await requestToJoin(C, 1);
    expect((await listStudyGroups(pagination(), A)).data.find((g) => g.id === 1)!.pendingRequestCount).toBe(1);

    await acceptJoinRequest(A, 1, C);

    expect((await listStudyGroups(pagination(), A)).data.find((g) => g.id === 1)!.pendingRequestCount).toBe(0);
  });

  it('updates the count after a request is rejected', async () => {
    await requestToJoin(C, 1);
    await rejectJoinRequest(A, 1, C);

    expect((await listStudyGroups(pagination(), A)).data.find((g) => g.id === 1)!.pendingRequestCount).toBe(0);
  });
});

describe('study group chat', () => {
  // Fixed reference so pagination window arithmetic is fully deterministic.
  const REF = new Date('2026-08-30T00:00:00Z').getTime();
  const isoAt = (daysAgo: number): string => new Date(REF - daysAgo * 86_400_000).toISOString();
  const msgAt = (id: number, daysAgo: number, sender: string, content: string): Row =>
    ({
      id,
      study_group_id: 1,
      sender_id: sender,
      content,
      created_at: isoAt(daysAgo),
    }) as Row;

  it('lists messages with sender profiles for a member', async () => {
    resetTables({
      study_group_messages: [
        msgAt(1, 1, B, 'Hello from Bob'),
        msgAt(2, 0, A, 'Hi Bob!'),
      ],
    });

    // `before` is exclusive, so use a bound one day after the newest message.
    const history = await listStudyGroupMessages(B, 1, { before: isoAt(-1) });
    expect(history.data).toHaveLength(2);
    expect(history.hasMore).toBe(false);
    expect(history.data[0]).toMatchObject({ studyGroupId: 1, content: 'Hello from Bob', sender: { id: B, firstName: 'Bob' } });
    expect(history.data[1]).toMatchObject({ content: 'Hi Bob!', sender: { id: A, firstName: 'Alice' } });
  });

  it('lets the owner and a member read and send messages', async () => {
    const sent = await sendStudyGroupMessage(B, 1, '  Hello group!  ');
    expect(sent.content).toBe('Hello group!');
    expect(sent.sender).toMatchObject({ id: B, firstName: 'Bob' });

    // `before` defaults to "now"; pass an explicit future bound so the just-sent
    // message is always strictly inside the window.
    const ownerRead = await listStudyGroupMessages(A, 1, {
      before: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(ownerRead.data).toHaveLength(1);
    expect(ownerRead.data[0]!.content).toBe('Hello group!');
  });

  it('lets the owner send even without a membership row', async () => {
    resetTables({ study_group_members: [memberRow(1, B, 'Bob')] });
    const sent = await sendStudyGroupMessage(A, 1, 'Owner hello');
    expect(sent.sender?.id).toBe(A);
  });

  it('blocks a pending requester from reading or sending messages', async () => {
    await requestToJoin(C, 1);
    await expect(listStudyGroupMessages(C, 1)).rejects.toMatchObject({
      code: 'NOT_MEMBER',
      statusCode: 403,
    });
    await expect(sendStudyGroupMessage(C, 1, 'hi')).rejects.toMatchObject({
      code: 'NOT_MEMBER',
      statusCode: 403,
    });
  });

  it('blocks an outsider from reading or sending messages', async () => {
    await expect(listStudyGroupMessages(D, 1)).rejects.toMatchObject({
      code: 'NOT_MEMBER',
      statusCode: 403,
    });
    await expect(sendStudyGroupMessage(D, 1, 'hi')).rejects.toMatchObject({
      code: 'NOT_MEMBER',
      statusCode: 403,
    });
  });

  it('rejects an empty message', async () => {
    await expect(sendStudyGroupMessage(B, 1, '   ')).rejects.toMatchObject({
      code: 'EMPTY_MESSAGE',
      statusCode: 400,
    });
  });

  it('throws 404 when the group does not exist', async () => {
    await expect(listStudyGroupMessages(A, 99999)).rejects.toMatchObject({
      code: 'STUDY_GROUP_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('defaults to the latest 15-day window when no cursor is supplied', async () => {
    // One message outside the 15-day window (relative to "now"), one inside.
    const outside = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const inside = new Date(Date.now() - 2 * 86_400_000).toISOString();
    resetTables({
      study_group_messages: [
        { id: 1, study_group_id: 1, sender_id: A, content: 'older-than-window', created_at: outside },
        { id: 2, study_group_id: 1, sender_id: B, content: 'recent', created_at: inside },
      ],
    });

    const history = await listStudyGroupMessages(B, 1);
    expect(history.data.map((m) => m.content)).toEqual(['recent']);
    expect(history.hasMore).toBe(true);
  });

  it('walks back one 15-day window at a time using the oldest message as the cursor', async () => {
    // Messages 1, 16, 31, 46 days old each land in successive 15-day windows.
    resetTables({
      study_group_messages: [
        msgAt(1, 1, A, 'page-1'),
        msgAt(2, 16, B, 'page-2'),
        msgAt(3, 31, A, 'page-3'),
        msgAt(4, 46, B, 'page-4'),
      ],
    });

    // Latest window: [REF-15d, REF) => the day-1 message.
    const page1 = await listStudyGroupMessages(B, 1, { before: isoAt(0) });
    expect(page1.data.map((m) => m.content)).toEqual(['page-1']);
    expect(page1.hasMore).toBe(true);
    const page1Oldest = page1.data[0]!.createdAt;
    expect(page1.nextCursor).toBe(page1Oldest);

    // Preceding window: [page1Oldest-15d, page1Oldest) => the day-16 message.
    const page2 = await listStudyGroupMessages(B, 1, { before: page1Oldest });
    expect(page2.data.map((m) => m.content)).toEqual(['page-2']);

    const page3 = await listStudyGroupMessages(B, 1, { before: page2.data[0]!.createdAt });
    expect(page3.data.map((m) => m.content)).toEqual(['page-3']);

    const page4 = await listStudyGroupMessages(B, 1, { before: page3.data[0]!.createdAt });
    expect(page4.data.map((m) => m.content)).toEqual(['page-4']);
    expect(page4.hasMore).toBe(false);
  });

  it('keeps walking through empty windows until real history is found', async () => {
    // Only a very old and a very recent message; the middle windows are empty.
    resetTables({
      study_group_messages: [
        msgAt(1, 1, A, 'newest'),
        msgAt(2, 46, B, 'oldest'),
      ],
    });

    const page1 = await listStudyGroupMessages(B, 1, { before: isoAt(0) });
    expect(page1.data.map((m) => m.content)).toEqual(['newest']);
    expect(page1.hasMore).toBe(true);

    // Next window is empty but hasMore is still true; nextCursor falls back to the window start.
    const page2 = await listStudyGroupMessages(B, 1, { before: page1.data[0]!.createdAt });
    expect(page2.data).toHaveLength(0);
    expect(page2.hasMore).toBe(true);
    expect(page2.nextCursor).toBe(isoAt(16));

    const page3 = await listStudyGroupMessages(B, 1, { before: page2.nextCursor! });
    expect(page3.data).toHaveLength(0);
    expect(page3.hasMore).toBe(true);
    expect(page3.nextCursor).toBe(isoAt(31));

    const page4 = await listStudyGroupMessages(B, 1, { before: page3.nextCursor! });
    expect(page4.data.map((m) => m.content)).toEqual(['oldest']);
    expect(page4.hasMore).toBe(false);
  });
});

describe('updateStudyGroup (owner edit)', () => {
  it('lets the owner update name, course, and meeting, and persists the change', async () => {
    const updated = await updateStudyGroup(A, 1, {
      name: 'Renamed Group',
      courseId: COURSE_2.id,
      bio: 'Updated bio',
      meetingDays: [2, 4],
      startTime: '09:00:00',
      endTime: '10:00:00',
    });

    expect(updated.name).toBe('Renamed Group');
    expect(updated.meeting).toEqual({ days: [2, 4], startTime: '09:00:00', endTime: '10:00:00' });

    const row = table('study_groups').find((g) => g.id === 1)!;
    expect(row.course_id).toBe(COURSE_2.id);
    expect(row.description).toBe('Updated bio');
    expect(row.meeting_days).toEqual([2, 4]);
  });

  it('rejects a non-owner trying to edit', async () => {
    await expect(
      updateStudyGroup(B, 1, { name: 'Nope', courseId: COURSE_1.id }),
    ).rejects.toMatchObject({ code: 'NOT_OWNER', statusCode: 403 });
  });

  it('rejects a pending requester trying to edit', async () => {
    await requestToJoin(C, 1);
    await expect(
      updateStudyGroup(C, 1, { name: 'Nope', courseId: COURSE_1.id }),
    ).rejects.toMatchObject({ code: 'NOT_OWNER', statusCode: 403 });
  });

  it('throws when the new course does not exist', async () => {
    await expect(
      updateStudyGroup(A, 1, { name: 'Bad', courseId: 999999 }),
    ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND', statusCode: 404 });
  });

  it('can clear an existing meeting time back to to-be-announced', async () => {
    const updated = await updateStudyGroup(A, 1, {
      name: 'Study Group 1',
      courseId: COURSE_1.id,
      meetingDays: [1],
      startTime: null,
      endTime: null,
    });

    expect(updated.meeting).toEqual({ days: [1], startTime: null, endTime: null });

    const row = table('study_groups').find((g) => g.id === 1)!;
    expect(row.start_time).toBeNull();
    expect(row.end_time).toBeNull();
  });
});

describe('removeStudyGroupMember (owner management)', () => {
  it('lets the owner remove a member and the member loses membership', async () => {
    await removeStudyGroupMember(A, 1, B);

    expect(
      table('study_group_members').some((m) => m.study_group_id === 1 && m.user_id === B),
    ).toBe(false);
    expect((await getStudyGroup(1, A)).memberCount).toBe(1);
  });

  it('blocks a non-owner from removing a member', async () => {
    await expect(removeStudyGroupMember(B, 1, C)).rejects.toMatchObject({
      code: 'NOT_OWNER',
      statusCode: 403,
    });
    // B still present.
    expect(
      table('study_group_members').some((m) => m.study_group_id === 1 && m.user_id === B),
    ).toBe(true);
  });

  it("prevents the owner from removing themselves", async () => {
    await expect(removeStudyGroupMember(A, 1, A)).rejects.toMatchObject({
      code: 'CANNOT_REMOVE_OWNER',
      statusCode: 400,
    });
  });

  it('throws 404 when the member is not in the group', async () => {
    await expect(removeStudyGroupMember(A, 1, D)).rejects.toMatchObject({
      code: 'MEMBER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('after removal the removed member cannot read chat', async () => {
    await sendStudyGroupMessage(B, 1, 'before removal');
    await removeStudyGroupMember(A, 1, B);

    await expect(listStudyGroupMessages(B, 1)).rejects.toMatchObject({
      code: 'NOT_MEMBER',
      statusCode: 403,
    });
  });
});
