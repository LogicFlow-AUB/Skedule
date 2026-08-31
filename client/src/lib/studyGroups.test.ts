import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMeetingFrequency, formatTime, toStudyGroup } from '../data/studyGroups.ts'
import type { StudyGroupSummary } from './api.ts'

const summary = (overrides: Partial<StudyGroupSummary> = {}): StudyGroupSummary => ({
  id: 1,
  name: 'Finals Squad',
  course: { id: 42, code: 'CMPS 214', title: 'Data Structures' },
  bio: 'Cram for the final together.',
  owner: { id: 'owner-1', firstName: 'Alice', lastName: 'T' },
  memberCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  meeting: { days: [1], startTime: '18:00:00', endTime: '19:00:00' },
  role: 'none',
  joined: false,
  requested: false,
  ...overrides,
})

test('toStudyGroup maps backend summary into the UI shape', () => {
  const group = toStudyGroup(summary())
  assert.equal(group.id, 1)
  assert.equal(group.name, 'Finals Squad')
  assert.equal(group.courseCode, 'CMPS 214')
  assert.equal(group.courseName, 'Data Structures')
  assert.equal(group.founder, 'Alice T')
  assert.equal(group.ownerId, 'owner-1')
  assert.equal(group.memberCount, 3)
  assert.equal(group.joined, false)
  assert.equal(group.requested, false)
  assert.equal(group.role, 'none')
  assert.equal(group.createdAt, new Date('2026-01-01T00:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))
})

test('toStudyGroup preserves joined, requested, and owner status', () => {
  assert.equal(toStudyGroup(summary({ joined: true, role: 'member' })).joined, true)
  assert.equal(toStudyGroup(summary({ requested: true, role: 'pending' })).requested, true)
  assert.equal(toStudyGroup(summary({ joined: true, role: 'owner' })).role, 'owner')
})

test('formatMeetingFrequency renders a recurring day and time', () => {
  const value = formatMeetingFrequency({ days: [1], startTime: '18:00:00', endTime: '19:00:00' })
  assert.equal(value, 'Every Tuesday, 6 PM – 7 PM')
})

test('formatMeetingFrequency handles multiple days', () => {
  const value = formatMeetingFrequency({ days: [1, 3], startTime: '09:30:00', endTime: '10:45:00' })
  assert.match(value, /Tue/)
  assert.match(value, /Thu/)
})

test('formatMeetingFrequency reports to be announced without a meeting', () => {
  assert.equal(formatMeetingFrequency(null), 'To be announced')
})

test('formatMeetingFrequency appends Time to be announced when a day exists but no time', () => {
  assert.equal(
    formatMeetingFrequency({ days: [1], startTime: null, endTime: null }),
    'Every Tuesday · Time to be announced',
  )
  assert.equal(
    formatMeetingFrequency({ days: [0, 2], startTime: null, endTime: null }),
    'Mon & Wed · Time to be announced',
  )
})

test('formatTime renders a 12-hour local representation without timezone shifting', () => {
  assert.equal(formatTime('18:00:00'), '6 PM')
  assert.equal(formatTime('18:30:00'), '6:30 PM')
  assert.equal(formatTime('09:00:00'), '9 AM')
  assert.equal(formatTime('12:00:00'), '12 PM')
  assert.equal(formatTime('00:30:00'), '12:30 AM')
  assert.equal(formatTime(null), '')
})

test('toStudyGroup maps a day without a time into meetingFrequency', () => {
  const group = toStudyGroup(summary({ meeting: { days: [1], startTime: null, endTime: null } }))
  assert.equal(group.meetingFrequency, 'Every Tuesday · Time to be announced')
})
