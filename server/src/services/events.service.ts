import { requireSupabaseClient } from '../db/supabase.js';
import type { Event } from '../db/types.js';
import { AppError } from '../utils/app-error.js';
import { createOffsetPage, type OffsetPage, type OffsetPagination } from '../utils/pagination.js';

export type CreateEventInput = {
  title: string;
  type: 'registration' | 'deadline' | 'class' | 'exam' | 'study' | 'academic' | 'social';
  startsAt: string;
  endsAt?: string;
  description?: string;
  location?: string;
  termId?: number;
};

export type EventSummary = {
  id: number;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string | null;
  description: string | null;
  location: string | null;
  termId: number | null;
  rsvpCount: number;
  rsvped: boolean;
};

export type EventDetail = EventSummary;

const EVENT_COLUMNS =
  'id, title, type, starts_at, ends_at, description, location, term_id, created_at';

function toSummary(event: Event, rsvpCount: number, rsvped: boolean): EventSummary {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    description: event.description,
    location: event.location,
    termId: event.term_id,
    rsvpCount,
    rsvped,
  };
}

async function getRsvpCounts(eventIds: number[]): Promise<Map<number, number>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const db = requireSupabaseClient();
  const counts = new Map<number, number>();

  const { data, error } = await db.from('event_rsvps').select('event_id').in('event_id', eventIds);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    counts.set(row.event_id as number, (counts.get(row.event_id as number) ?? 0) + 1);
  }

  return counts;
}

async function getUserRsvps(eventIds: number[], userId: string): Promise<Set<number>> {
  if (eventIds.length === 0) {
    return new Set();
  }

  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('event_rsvps')
    .select('event_id')
    .in('event_id', eventIds)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.event_id as number));
}

export async function listEvents(
  pagination: OffsetPagination,
  userId?: string,
): Promise<OffsetPage<EventSummary>> {
  const db = requireSupabaseClient();
  const { data, error, count } = await db
    .from('events')
    .select(EVENT_COLUMNS, { count: 'exact' })
    .order('starts_at', { ascending: true })
    .range(pagination.offset, pagination.offset + pagination.limit - 1);

  if (error) {
    throw error;
  }

  const events = (data ?? []) as Event[];
  const eventIds = events.map((e) => e.id);
  const rsvpCounts = await getRsvpCounts(eventIds);
  const userRsvps = userId ? await getUserRsvps(eventIds, userId) : new Set<number>();

  return createOffsetPage(
    events.map((event) => toSummary(event, rsvpCounts.get(event.id) ?? 0, userRsvps.has(event.id))),
    count ?? 0,
    pagination,
  );
}

export async function getEvent(id: number, userId?: string): Promise<EventDetail> {
  const db = requireSupabaseClient();
  const { data, error } = await db.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found.');
  }

  const event = data as Event;
  const rsvpCounts = await getRsvpCounts([id]);
  const userRsvps = userId ? await getUserRsvps([id], userId) : new Set<number>();

  return toSummary(event, rsvpCounts.get(id) ?? 0, userRsvps.has(id));
}

export async function createEvent(userId: string, input: CreateEventInput): Promise<EventDetail> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('events')
    .insert({
      title: input.title,
      type: input.type,
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      description: input.description ?? null,
      location: input.location ?? null,
      term_id: input.termId ?? null,
    })
    .select(EVENT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  const event = data as Event;

  // Auto-RSVP the creator
  await db.from('event_rsvps').insert({ event_id: event.id, user_id: userId }).select();

  return getEvent(event.id, userId);
}

export async function rsvpEvent(userId: string, eventId: number): Promise<void> {
  const db = requireSupabaseClient();

  // Verify event exists
  await getEvent(eventId);

  const { error } = await db.from('event_rsvps').insert({ event_id: eventId, user_id: userId });

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'ALREADY_RSVPED', 'You have already RSVPed to this event.');
    }
    throw error;
  }
}

export async function cancelRsvp(userId: string, eventId: number): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db
    .from('event_rsvps')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
