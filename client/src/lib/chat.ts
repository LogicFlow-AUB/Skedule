import { displayName } from '../data/studyGroups.ts'

/**
 * A single chat message in the shape the UI renders. `date` is the parsed,
 * absolute instant for the message so time/day labels can be rendered in the
 * browser's local timezone.
 */
export interface ChatItem {
  id: number
  sender: string
  senderId?: string
  text: string
  date: Date
  currentUser?: boolean
}

/**
 * Parse a backend timestamp into a `Date`.
 *
 * The backend stores timestamps as UTC (`timestamptz`) and returns them with a
 * timezone marker (e.g. "2026-08-30T20:42:00.000+00:00"). Parsing such a string
 * with `new Date(...)` yields the correct absolute instant.
 *
 * Some producers may still hand us a timezone-less ISO string (e.g. a naive
 * "2026-08-30T20:42:00"). JavaScript would normally interpret that as
 * *local* time, which shifts the instant by the browser's UTC offset (that was
 * the root cause of the "3 hours behind" bug for a UTC+3 browser). Since the
 * backend writes UTC, we explicitly treat timezone-less strings as UTC by
 * appending "Z" before parsing.
 */
export function parseChatTimestamp(value: string): Date {
  const hasTimezone = /(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/.test(value)
  const normalized = hasTimezone ? value : `${value}Z`
  return new Date(normalized)
}

/** Format a message instant as a local time-of-day, e.g. "6:42 PM". */
export function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Format a message instant as a readable local date, e.g. "August 30, 2026". */
export function formatMessageDay(date: Date): string {
  return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
}

/** The number of calendar days loaded per chat-history page. */
export const CHAT_HISTORY_WINDOW_DAYS = 15

/**
 * Merge newly-fetched (older) messages with the currently loaded set.
 *
 * Older pages are prepended, so incoming messages are older/earlier than the
 * existing ones. Messages are deduplicated by id and the combined set is
 * re-sorted ascending by time so no page-boundary duplicates appear.
 */
export function mergeChatMessages(
  existing: ChatItem[],
  incoming: ChatItem[],
): ChatItem[] {
  const byId = new Map<number, ChatItem>()
  for (const message of [...existing, ...incoming]) {
    byId.set(message.id, message)
  }
  return [...byId.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id,
  )
}

/** The cursor to request even older history is the oldest loaded message. */
export function oldestCursor(messages: ChatItem[]): string | null {
  if (messages.length === 0) {
    return null
  }
  const oldest = [...messages].sort((a, b) => a.date.getTime() - b.date.getTime())[0]!
  return oldest.date.toISOString()
}

/**
 * Build a render-ready ChatItem from a row returned by the messages endpoint.
 * `currentUserId` is compared against the sender to mark the current user's
 * own messages right-aligned.
 */
export function toChatItem(
  message: {
    id: number
    sender: { id: string; firstName: string | null; lastName: string | null } | null
    content: string
    createdAt: string
  },
  currentUserId: string,
): ChatItem {
  return {
    id: message.id,
    sender: message.sender
      ? displayName(message.sender.firstName, message.sender.lastName)
      : 'A student',
    senderId: message.sender?.id,
    text: message.content,
    date: parseChatTimestamp(message.createdAt),
    currentUser: message.sender?.id === currentUserId,
  }
}
