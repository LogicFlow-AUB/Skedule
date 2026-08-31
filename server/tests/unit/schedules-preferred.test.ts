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
  createSchedule,
  deleteSchedule,
  getPreferredScheduleForUser,
  saveSchedule,
  setFavorite,
} from '../../src/services/schedules.service.js';

const USER = 'user-a';

function schedule(id: number, over: Row = {}): Row {
  return {
    id,
    user_id: USER,
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

function preferredScheduleIds(userId: string): number[] {
  const schedules = fakeClient.value!.from('schedules').select('id');
  const rows = (schedules as unknown as { table: Row[] }).table;
  return rows.filter((row) => row.user_id === userId && row.is_favorite === true).map((row) => row.id as number);
}

function savedIds(userId: string): number[] {
  const schedules = fakeClient.value!.from('schedules').select('id');
  const rows = (schedules as unknown as { table: Row[] }).table;
  return rows.filter((row) => row.user_id === userId && row.saved === true).map((row) => row.id as number);
}

function resetTables(rows: Row[]) {
  fakeClient.value = createFakeSupabase({
    schedules: rows.map((row) => ({ ...row })),
    schedule_sections: [],
  });
}

beforeEach(() => {
  resetTables([]);
});

describe('preferred schedule rules', () => {
  it('saving the FIRST schedule automatically makes it preferred', async () => {
    resetTables([schedule(1, { saved: false, is_favorite: false })]);

    const saved = await saveSchedule(USER, 1);

    expect(saved.saved).toBe(true);
    expect(saved.isFavorite).toBe(true);
    expect(preferredScheduleIds(USER)).toEqual([1]);
  });

  it('creating the FIRST saved schedule automatically makes it preferred', async () => {
    const created = await createSchedule(USER, { name: 'First', saved: true });

    expect(created.isFavorite).toBe(true);
  });

  it('a single saved schedule stays preferred (no unset action exists) and exactly one is preferred', async () => {
    resetTables([schedule(1, { saved: false })]);

    await saveSchedule(USER, 1);
    await setFavorite(USER, 1);

    expect(preferredScheduleIds(USER)).toEqual([1]);

    const preferred = await getPreferredScheduleForUser(USER);
    expect(preferred?.id).toBe(1);
  });

  it('saving an additional schedule does not demote the existing preferred schedule', async () => {
    resetTables([
      schedule(1, { saved: false }),
      schedule(2, { saved: false }),
    ]);

    await saveSchedule(USER, 1);
    await saveSchedule(USER, 2);

    expect(preferredScheduleIds(USER)).toEqual([1]);

    const preferred = await getPreferredScheduleForUser(USER);
    expect(preferred?.id).toBe(1);
  });

  it('saving a second schedule allows switching the preferred schedule', async () => {
    resetTables([
      schedule(1, { saved: false }),
      schedule(2, { saved: false }),
    ]);

    await saveSchedule(USER, 1);
    await saveSchedule(USER, 2);

    await setFavorite(USER, 2);

    expect(preferredScheduleIds(USER)).toEqual([2]);
  });

  it('switching preferred removes preferred status from the previous preferred schedule', async () => {
    resetTables([
      schedule(1, { saved: false }),
      schedule(2, { saved: false }),
    ]);

    await saveSchedule(USER, 1);
    await saveSchedule(USER, 2);
    await setFavorite(USER, 2);

    const rows = (fakeClient.value!.from('schedules').select('id') as unknown as { table: Row[] }).table;
    const first = rows.find((row) => row.id === 1)!;
    const second = rows.find((row) => row.id === 2)!;

    expect(first.is_favorite).toBe(false);
    expect(second.is_favorite).toBe(true);
  });

  it('exactly one saved schedule is preferred at a time while multiple schedules exist', async () => {
    resetTables([
      schedule(1, { saved: false }),
      schedule(2, { saved: false }),
      schedule(3, { saved: false }),
    ]);

    await saveSchedule(USER, 1);
    await saveSchedule(USER, 2);
    await saveSchedule(USER, 3);
    await setFavorite(USER, 2);

    expect(preferredScheduleIds(USER)).toHaveLength(1);
    expect(preferredScheduleIds(USER)).toEqual([2]);
  });

  it('deleting the only preferred schedule leaves the user with no saved and no preferred schedule', async () => {
    resetTables([schedule(1, { saved: true, is_favorite: true })]);

    await deleteSchedule(USER, 1);

    expect(savedIds(USER)).toEqual([]);
    expect(preferredScheduleIds(USER)).toEqual([]);
    await expect(getPreferredScheduleForUser(USER)).resolves.toBeNull();
  });

  it('deleting the preferred schedule promotes the latest remaining saved schedule', async () => {
    resetTables([
      schedule(1, { saved: true, is_favorite: true, created_at: '2026-01-01T00:00:00Z' }),
      schedule(2, { saved: true, is_favorite: false, created_at: '2026-01-02T00:00:00Z' }),
      schedule(3, { saved: true, is_favorite: false, created_at: '2026-01-03T00:00:00Z' }),
    ]);

    await deleteSchedule(USER, 1);

    expect(savedIds(USER).sort((a, b) => a - b)).toEqual([2, 3]);
    expect(preferredScheduleIds(USER)).toEqual([3]);
  });

  it('deleting a NON-preferred schedule keeps the current preferred schedule unchanged', async () => {
    resetTables([
      schedule(1, { saved: true, is_favorite: true, created_at: '2026-01-01T00:00:00Z' }),
      schedule(2, { saved: true, is_favorite: false, created_at: '2026-01-02T00:00:00Z' }),
    ]);

    await deleteSchedule(USER, 2);

    expect(preferredScheduleIds(USER)).toEqual([1]);
  });

  it('getPreferredScheduleForUser returns the preferred schedule and never falls back to another saved schedule', async () => {
    resetTables([
      schedule(1, { saved: true, is_favorite: false, created_at: '2026-01-01T00:00:00Z' }),
      schedule(2, { saved: true, is_favorite: true, created_at: '2026-01-02T00:00:00Z' }),
    ]);

    const preferred = await getPreferredScheduleForUser(USER);

    expect(preferred?.id).toBe(2);
  });

  it('getPreferredScheduleForUser returns null when the user has saved schedules but none preferred', async () => {
    resetTables([
      schedule(1, { saved: true, is_favorite: false }),
      schedule(2, { saved: true, is_favorite: false }),
    ]);

    await expect(getPreferredScheduleForUser(USER)).resolves.toBeNull();
  });
});