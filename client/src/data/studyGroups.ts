import type { StudyGroupSummary } from '../lib/api'

export interface StudyGroup {
  id: number
  name: string
  courseId?: number
  courseCode: string
  courseName: string
  description: string
  details: string
  founder: string
  ownerId: string
  createdAt: string
  memberCount: number
  meetingFrequency: string
  status: 'Open' | 'Active'
  joined: boolean
  role: StudyGroupSummary['role']
  requested: boolean
  meeting: StudyGroupSummary['meeting']
  pendingRequestCount?: number
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Build a display name from a user's first/last name. */
export function displayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'A student'
}

/** Format a "HH:mm:ss"/"HH:mm" time value into a 12-hour display label. */
export function formatTime(value: string | null): string {
  if (!value) return ''
  const [hours, minutes] = value.split(':').map(Number)
  if (hours == null || Number.isNaN(hours)) return value
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const minute = minutes != null && !Number.isNaN(minutes) && minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''
  return `${hour12}${minute} ${period}`
}

/** Format recurring meet day(s)/time, e.g. "Every Tuesday, 6:00 PM – 7:00 PM". */
export function formatMeetingFrequency(meeting: StudyGroupSummary['meeting']): string {
  if (!meeting || !meeting.days.length) return 'To be announced'
  const dayText = meeting.days.length === 1
    ? `Every ${DAY_NAMES[meeting.days[0]] ?? 'day'}`
    : `${meeting.days.map((day) => DAY_NAMES[day % 7].slice(0, 3)).join(' & ')}`
  const start = formatTime(meeting.startTime)
  const end = formatTime(meeting.endTime)
  if (start && end) {
    return `${dayText}, ${start} – ${end}`
  }
  if (start || end) {
    return `${dayText}, ${start || end}`
  }
  return `${dayText} · Time to be announced`
}

/** Map a backend study group summary into the shape the existing UI expects. */
export function toStudyGroup(group: StudyGroupSummary): StudyGroup {
  return {
    id: group.id,
    name: group.name,
    courseId: group.course?.id,
    courseCode: group.course?.code ?? '',
    courseName: group.course?.title ?? '',
    description: group.bio ?? '',
    details: group.bio ?? '',
    founder: group.owner ? displayName(group.owner.firstName, group.owner.lastName) : 'Unknown',
    ownerId: group.owner?.id ?? '',
    createdAt: new Date(group.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    memberCount: group.memberCount,
    meetingFrequency: formatMeetingFrequency(group.meeting),
    status: group.joined ? 'Active' : 'Open',
    joined: group.joined,
    role: group.role,
    requested: group.requested,
    meeting: group.meeting,
    pendingRequestCount: group.pendingRequestCount,
  }
}

export interface ChatMessage { id: number; sender: string; senderId?: string; text: string; timestamp: string; currentUser?: boolean }

export const MOCK_MESSAGES: Record<number, ChatMessage[]> = {}
