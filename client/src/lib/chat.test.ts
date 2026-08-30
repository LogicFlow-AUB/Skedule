import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_HISTORY_WINDOW_DAYS,
  formatMessageDay,
  formatMessageTime,
  mergeChatMessages,
  oldestCursor,
  parseChatTimestamp,
  toChatItem,
  type ChatItem,
} from './chat.ts'

const item = (id: number, iso: string, overrides: Partial<ChatItem> = {}): ChatItem => ({
  id,
  sender: 'Alice T',
  text: `message ${id}`,
  date: new Date(iso),
  ...overrides,
})

test('parseChatTimestamp treats a timezone-less string as UTC', () => {
  const naive = parseChatTimestamp('2026-08-30T18:42:00')
  const explicit = parseChatTimestamp('2026-08-30T18:42:00Z')
  const withOffset = parseChatTimestamp('2026-08-30T18:42:00+03:00')
  assert.equal(naive.getTime(), explicit.getTime())
  assert.equal(withOffset.getTime(), explicit.getTime() - 3 * 3600 * 1000)
})

test('parseChatTimestamp preserves an explicit timezone marker', () => {
  const marked = parseChatTimestamp('2026-08-30T18:42:00.000+00:00')
  const expected = new Date('2026-08-30T18:42:00.000Z')
  assert.equal(marked.getTime(), expected.getTime())
})

test('there is no fixed 3-hour shift: naive and Z timestamps are the same instant', () => {
  const offsetToNow = new Date().getTimezoneOffset()
  const naive = parseChatTimestamp('2026-08-30T18:42:00')
  const zulu = parseChatTimestamp('2026-08-30T18:42:00Z')
  assert.equal(naive.getTime(), zulu.getTime())
  // Rendered local time reflects the browser offset, not a hard-coded +3.
  const localTime = naive.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  assert.equal(localTime, '6:42 PM')
  void offsetToNow
})

test('formatMessageTime and formatMessageDay render local time labels', () => {
  const date = parseChatTimestamp('2026-08-30T18:42:00')
  assert.equal(formatMessageTime(date), date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
  assert.equal(formatMessageDay(date), date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }))
})

test('mergeChatMessages prepends older messages, dedupes by id, and sorts ascending', () => {
  const existing = [item(3, '2026-08-30T12:00:00Z'), item(4, '2026-08-30T13:00:00Z')]
  const incoming = [item(1, '2026-08-29T12:00:00Z'), item(2, '2026-08-30T11:00:00Z'), item(4, '2026-08-30T13:00:00Z')]
  const merged = mergeChatMessages(existing, incoming)
  assert.deepEqual(merged.map((m) => m.id), [1, 2, 2 + 1, 4].slice(0, 4))
})

test('mergeChatMessages never produces duplicates', () => {
  const existing = [item(5, '2026-08-30T10:00:00Z')]
  const incoming = [item(5, '2026-08-30T10:00:00Z'), item(6, '2026-08-30T11:00:00Z')]
  const merged = mergeChatMessages(existing, incoming)
  assert.equal(new Set(merged.map((m) => m.id)).size, merged.length)
  assert.deepEqual(merged.map((m) => m.id), [5, 6])
})

test('oldestCursor returns the oldest message as an ISO string', () => {
  const messages = [item(2, '2026-08-30T12:00:00Z'), item(1, '2026-08-29T12:00:00Z'), item(3, '2026-08-31T12:00:00Z')]
  assert.equal(oldestCursor(messages), '2026-08-29T12:00:00.000Z')
})

test('oldestCursor returns null when there are no messages', () => {
  assert.equal(oldestCursor([]), null)
})

test('toChatItem marks the current user and falls back to a default sender', () => {
  const mine = toChatItem(
    { id: 7, sender: { id: 'u-1', firstName: 'Alice', lastName: 'T' }, content: 'hello', createdAt: '2026-08-30T18:42:00' },
    'u-1',
  )
  assert.equal(mine.sender, 'Alice T')
  assert.equal(mine.currentUser, true)
  assert.equal(mine.text, 'hello')

  const anonymous = toChatItem(
    { id: 8, sender: null, content: 'hi', createdAt: '2026-08-30T18:42:00' },
    'u-1',
  )
  assert.equal(anonymous.sender, 'A student')
  assert.equal(anonymous.currentUser, false)
})

test('chat history window constant is 15 days', () => {
  assert.equal(CHAT_HISTORY_WINDOW_DAYS, 15)
})
