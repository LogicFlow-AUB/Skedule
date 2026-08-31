import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeClient = { value: null as ReturnType<typeof createFakeSupabase> | null };

const { trackActivity, notifyFriendRequestReceived, notifyFriendRequestAccepted } = vi.hoisted(
  () => ({
    trackActivity: vi.fn(async () => undefined),
    notifyFriendRequestReceived: vi.fn(async () => undefined),
    notifyFriendRequestAccepted: vi.fn(async () => undefined),
  }),
);

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));
vi.mock('../../src/services/activity.service.js', () => ({ trackActivity }));
vi.mock('../../src/services/notifications.service.js', () => ({
  notifyFriendRequestReceived,
  notifyFriendRequestAccepted,
}));

import { createFakeSupabase, type Row } from '../fixtures/fake-supabase.js';
import { getCommonFreeTime, getFriendSchedule } from '../../src/services/friends.service.js';
import { setFavorite } from '../../src/services/schedules.service.js';

const A = 'student-a';
const B = 'student-b';
const C = 'student-c';

function userRow(id: string, firstName: string): Row {
  return {
    id,
    first_name: firstName,
    last_name: 'Test',
    major: 'CS',
    level: 'Senior',
    presence_status: 'online',
    last_seen_at: '2026-01-01T00:00:00Z',
  };
}

function scheduleRow(id: number, userId: string, over: Row = {}): Row {
  return {
    id,
    user_id: userId,
    name: `Schedule ${id}`,
    notes: null,
    term_id: null,
    saved: true,
    is_favorite: false,
    created_at: `2026-01-${String(id).padStart(2, '0')}T00:00:00Z`,
    updated_at: `2026-01-${String(id).padStart(2, '0')}T00:00:00Z`,
    ...over,
  };
}

function sectionRow(scheduleId: number, days: string, startTime: string, endTime: string): Row {
  return {
    schedule_id: scheduleId,
    sections: { days, start_time: startTime, end_time: endTime },
  };
}

type FreeSlot = { day: number; label: string; startHour: number; endHour: number };

function slot(day: number, startHour: number, endHour: number): FreeSlot {
  return { day, label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][day], startHour, endHour };
}

type Tables = { users: Row[]; friendships: Row[]; schedules: Row[]; schedule_sections: Row[] };

function resetTables(tables: Tables) {
  fakeClient.value = createFakeSupabase({
    users: tables.users.map((row) => ({ ...row })),
    friendships: tables.friendships.map((row) => ({ ...row })),
    schedules: tables.schedules.map((row) => ({ ...row })),
    schedule_sections: tables.schedule_sections.map((row) => ({ ...row })),
  });
}

function abFriendship(status = 'accepted') {
  return { id: 1, user_id: A, friend_id: B, status, created_at: '2026-01-01T00:00:00Z' };
}

beforeEach(() => {
  resetTables({ users: [], friendships: [], schedules: [], schedule_sections: [] });
});

describe('Common Free Time uses preferred schedules', () => {
  it("uses the current student's preferred schedule, not an arbitrary saved schedule", async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [
        // A's LATEST saved schedule (non-preferred, Mon 8-9) must be ignored.
        sectionRow(1, 'M', '08:00:00', '09:00:00'),
        // A's preferred schedule (Mon 10-11).
        sectionRow(2, 'M', '10:00:00', '11:00:00'),
        // B's preferred schedule (Mon 16-17).
        sectionRow(3, 'M', '16:00:00', '17:00:00'),
      ],
      schedules: [
        scheduleRow(1, A, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(2, A, { is_favorite: true, created_at: '2026-01-05T00:00:00Z' }),
        scheduleRow(3, B, { is_favorite: true }),
      ],
    });

    const result = await getCommonFreeTime(A);

    const mondaySlots = result.commonFreeSlots.filter((s: FreeSlot) => s.day === 0);
    // A busy Mon 10-11, B busy Mon 16-17.
    expect(mondaySlots).toContainEqual(slot(0, 7, 10));
    expect(mondaySlots).toContainEqual(slot(0, 11, 16));
    expect(mondaySlots).toContainEqual(slot(0, 17, 21));
  });

  it("uses each friend's preferred schedule and ignores non-preferred saved schedules", async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [
        // A non-preferred (latest) Mon 8-9.
        sectionRow(1, 'M', '08:00:00', '09:00:00'),
        // A preferred Mon 10-11.
        sectionRow(2, 'M', '10:00:00', '11:00:00'),
        // B non-preferred (latest) Mon 14-15.
        sectionRow(3, 'M', '14:00:00', '15:00:00'),
        // B preferred Mon 16-17.
        sectionRow(4, 'M', '16:00:00', '17:00:00'),
      ],
      schedules: [
        scheduleRow(1, A, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(2, A, { is_favorite: true, created_at: '2026-01-05T00:00:00Z' }),
        scheduleRow(3, B, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(4, B, { is_favorite: true, created_at: '2026-01-05T00:00:00Z' }),
      ],
    });

    const result = await getCommonFreeTime(A);

    const mondaySlots = result.commonFreeSlots.filter((s: FreeSlot) => s.day === 0);
    // If B's non-preferred 14-15 were used, this range would be split into 11-14 and 15-16.
    expect(mondaySlots).toContainEqual(slot(0, 11, 16));
    // B is busy 16-17, so that range cannot be a common free slot.
    expect(mondaySlots).not.toContainEqual(slot(0, 16, 21));
    expect(mondaySlots).toContainEqual(slot(0, 17, 21));
  });

  it('multiple friends each use their own preferred schedule', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella'), userRow(C, 'Carla')],
      friendships: [
        abFriendship(),
        { id: 2, user_id: A, friend_id: C, status: 'accepted', created_at: '2026-01-01T00:00:00Z' },
      ],
      schedule_sections: [
        sectionRow(1, 'M', '10:00:00', '11:00:00'),
        sectionRow(2, 'M', '16:00:00', '17:00:00'),
        sectionRow(3, 'T', '10:00:00', '11:00:00'),
      ],
      schedules: [
        scheduleRow(1, A, { is_favorite: true }),
        scheduleRow(2, B, { is_favorite: true }),
        scheduleRow(3, C, { is_favorite: true }),
      ],
    });

    const result = await getCommonFreeTime(A);

    expect(result.friendCount).toBe(2);
    const tuesdaySlots = result.commonFreeSlots.filter((s: FreeSlot) => s.day === 1);
    // C busy Tue 10-11.
    expect(tuesdaySlots).toContainEqual(slot(1, 7, 10));
    expect(tuesdaySlots).toContainEqual(slot(1, 11, 21));
  });

  it('a participant with no preferred schedule is handled as having no busy blocks', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [
        // B has saved schedules but NONE preferred (Mon 8-9, Mon 9-10).
        sectionRow(1, 'M', '08:00:00', '09:00:00'),
        sectionRow(2, 'M', '09:00:00', '10:00:00'),
        // A preferred Mon 10-11.
        sectionRow(3, 'M', '10:00:00', '11:00:00'),
      ],
      schedules: [
        scheduleRow(1, B, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(2, B, { created_at: '2026-01-05T00:00:00Z' }),
        scheduleRow(3, A, { is_favorite: true }),
      ],
    });

    const result = await getCommonFreeTime(A);

    // B's non-preferred 8-10 and 9-10 must be ignored; the only busy block is
    // A's preferred Mon 10-11.
    const mondaySlots = result.commonFreeSlots.filter((s: FreeSlot) => s.day === 0);
    expect(mondaySlots).toContainEqual(slot(0, 7, 10));
  });

  it('changing the preferred schedule changes the schedule used by Common Free Time', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [
        sectionRow(1, 'M', '08:00:00', '09:00:00'),
        sectionRow(2, 'M', '10:00:00', '11:00:00'),
        sectionRow(3, 'M', '16:00:00', '17:00:00'),
      ],
      schedules: [
        scheduleRow(1, A, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(2, A, { is_favorite: true, created_at: '2026-01-05T00:00:00Z' }),
        scheduleRow(3, B, { is_favorite: true }),
      ],
    });

    const before = await getCommonFreeTime(A);
    expect(before.commonFreeSlots.filter((s: FreeSlot) => s.day === 0)).toContainEqual(slot(0, 11, 16));

    // Switch A's preferred from schedule 2 (Mon 10-11) to schedule 1 (Mon 8-9).
    await setFavorite(A, 1);

    const after = await getCommonFreeTime(A);
    const mondaySlots = after.commonFreeSlots.filter((s: FreeSlot) => s.day === 0);
    // A is now busy Mon 8-9, B busy Mon 16-17.
    expect(mondaySlots).toContainEqual(slot(0, 7, 8));
    expect(mondaySlots).toContainEqual(slot(0, 9, 16));
    expect(mondaySlots).toContainEqual(slot(0, 17, 21));
  });
});

describe('getFriendSchedule uses the friend preferred schedule', () => {
  it('returns the friend preferred schedule, not the latest saved schedule', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [],
      schedules: [
        scheduleRow(1, B, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(2, B, { is_favorite: true, created_at: '2026-01-05T00:00:00Z' }),
      ],
    });

    const schedule = await getFriendSchedule(A, B);

    expect(schedule?.id).toBe(2);
  });

  it('returns null when the friend has no preferred schedule', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [],
      schedules: [
        scheduleRow(1, B, { created_at: '2026-01-10T00:00:00Z' }),
        scheduleRow(2, B, { created_at: '2026-01-05T00:00:00Z' }),
      ],
    });

    await expect(getFriendSchedule(A, B)).resolves.toBeNull();
  });

  it('returns null when the friend has no saved schedules', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(B, 'Bella')],
      friendships: [abFriendship()],
      schedule_sections: [],
      schedules: [],
    });

    await expect(getFriendSchedule(A, B)).resolves.toBeNull();
  });

  it('throws NOT_FRIENDS when the participant is not an accepted friend', async () => {
    resetTables({
      users: [userRow(A, 'Alice'), userRow(C, 'Carla')],
      friendships: [abFriendship('pending')],
      schedule_sections: [],
      schedules: [scheduleRow(1, C, { is_favorite: true })],
    });

    await expect(getFriendSchedule(A, C)).rejects.toMatchObject({
      code: 'NOT_FRIENDS',
      statusCode: 403,
    });
  });
});