import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Trash2, Sparkles, RotateCcw, Zap, Pencil,
  Eye, ArrowLeftRight, Send, Bot, User, AlertCircle,
  BookOpen, Clock, MapPin, Star, TrendingUp, Bookmark,
  GripVertical, Search, CalendarDays, CheckCircle,
} from 'lucide-react'
import type { Page } from '../App'
import { api, type CourseSummary, type CourseSection, type CourseReview, type GradeDistributionRow, type SectionMeeting } from '../lib/api'
import { displayName, timeAgo } from '../lib/format'
import { buildOptimizeRequest, onlineOptimizerSections, optimizerMeetingOccurrences, validateOptimizerResult, type AttributeOption, type CourseOption, type OptimizeScheduleResult, type OptimizerFormState, type SelectedSection, type TermOption } from '../lib/scheduleOptimizer'

const HOUR_HEIGHT = 60 // px per hour
const START_HOUR = 7   // 7 AM
const END_HOUR = 21    // 9 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)

const COURSE_COLORS = ['#4338CA', '#059669', '#0284C7', '#7C3AED', '#D97706', '#10B981', '#F59E0B', '#DC2626']

interface Course {
  id: string
  code: string
  name: string
  section: string
  professor: string
  room: string
  days: number[]  // 0=Mon..4=Fri
  startHour: number
  startMin: number
  durationMin: number
  color: string
  colorLight: string
  credits: number
  sectionId: number | null
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatHour(h: number) {
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&apos;|&quot;|&lt;|&gt;|&amp;/g, (entity) => ({
      '&apos;': "'",
      '&quot;': '"',
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
    })[entity] ?? entity)
}

function courseTop(c: Course) {
  return (c.startHour - START_HOUR + c.startMin / 60) * HOUR_HEIGHT
}
function courseHeight(c: Course) {
  return (c.durationMin / 60) * HOUR_HEIGHT
}
function courseEndTime(c: Course) {
  const totalMin = c.startHour * 60 + c.startMin + c.durationMin
  const endH = Math.floor(totalMin / 60)
  const endM = totalMin % 60
  const label = endH > 12 ? `${endH - 12}:${endM.toString().padStart(2, '0')} PM` : `${endH}:${endM.toString().padStart(2, '0')} AM`
  return label
}
function courseStartTime(c: Course) {
  const h = c.startHour
  const m = c.startMin
  const label = h > 12 ? `${h - 12}:${m.toString().padStart(2, '0')} PM` : `${h}:${m.toString().padStart(2, '0')} AM`
  return label
}

function parseDays(days: string | null): number[] {
  if (!days) {
    return []
  }

  const numericDays = days.match(/\b[1-5]\b/g)
  if (numericDays?.length) {
    return [...new Set(numericDays.map((day) => Number(day) - 1))].sort((a, b) => a - b)
  }

  const DAY_CODES: Record<string, number> = { M: 0, T: 1, W: 2, R: 3, F: 4 }
  const DAY_NAMES: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4 }
  const parsed = new Set<number>()

  for (const token of days.trim().toUpperCase().split(/[^A-Z]+/)) {
    if (!token) continue
    const named = DAY_NAMES[token.slice(0, 3)]
    if (token.length >= 3 && named !== undefined) {
      parsed.add(named)
      continue
    }
    for (const ch of token) {
      const day = DAY_CODES[ch]
      if (day !== undefined) parsed.add(day)
    }
  }

  return [...parsed].sort((a, b) => a - b)
}

function parseTime(t: string | null): { hours: number; minutes: number } | null {
  if (!t) {
    return null
  }
  const normalized = t.trim()
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(normalized)
  if (twelveHour) {
    const hours = Number(twelveHour[1])
    const minutes = Number(twelveHour[2])
    if (hours < 1 || hours > 12 || minutes > 59) return null
    return { hours: (hours % 12) + (twelveHour[3]?.toUpperCase() === 'PM' ? 12 : 0), minutes }
  }

  const compact = /^(\d{2})(\d{2})$/.exec(normalized)
  const match = /^(\d{1,2}):(\d{2})/.exec(normalized)
  const hours = Number(compact?.[1] ?? match?.[1])
  const minutes = Number(compact?.[2] ?? match?.[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null
  }
  return { hours, minutes }
}

function daysLabel(days: number[]): string {
  if (days.length === 0) {
    return '—'
  }
  return days.map((d) => DAYS[d] ?? `Day ${d}`).join('/')
}

function timeLabel(t: string | null): string {
  if (!t) {
    return '—'
  }
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

function durationMinutes(start: string | null, end: string | null): number {
  const s = parseTime(start)
  const e = parseTime(end)
  if (!s || !e) {
    return 60
  }
  return Math.max(0, e.hours * 60 + e.minutes - (s.hours * 60 + s.minutes))
}

// ----- Course Detail Modal -----

/** Convert a SectionMeeting's boolean day fields to number[] (0=Mon..4=Fri) */
function meetingDaysToNumbers(mt: SectionMeeting): number[] {
  const days: number[] = []
  if (mt.monday) days.push(0)
  if (mt.tuesday) days.push(1)
  if (mt.wednesday) days.push(2)
  if (mt.thursday) days.push(3)
  if (mt.friday) days.push(4)
  return days
}

/** Group sections by link_identifier (or use section id as unique key) */
type SectionGroup = {
  key: string
  sections: CourseSection[]
}

function groupSectionsByLink(sections: CourseSection[]): SectionGroup[] {
  const groups = new Map<string, CourseSection[]>()
  for (const sec of sections) {
    const key = sec.link_identifier ?? String(sec.id)
    const existing = groups.get(key)
    if (existing) {
      existing.push(sec)
    } else {
      groups.set(key, [sec])
    }
  }
  return [...groups.values()].map((g) => ({
    key: g[0]?.link_identifier ?? String(g[0]?.id),
    sections: g,
  }))
}

/** Build a human-readable summary of a section group for the picker */
function sectionGroupSummary(group: SectionGroup): string {
  const parts: string[] = []
  for (const sec of group.sections) {
    const type = sec.schedule_type ?? sec.meeting_schedule_type ?? 'Class'
    const meetings = sec.section_meetings ?? []
    if (meetings.length > 0) {
      for (const mt of meetings) {
        const mtDays = daysLabel(meetingDaysToNumbers(mt))
        const mtTime = `${timeLabel(mt.start_time)}–${timeLabel(mt.end_time)}`
        parts.push(`${type}: ${mtDays} ${mtTime}`)
      }
    } else {
      const mtDays = daysLabel(parseDays(sec.days))
      const mtTime = `${timeLabel(sec.start_time)}–${timeLabel(sec.end_time)}`
      parts.push(`${type}: ${mtDays} ${mtTime}`)
    }
  }
  return parts.join(' + ')
}

function CourseModal({ course, onSwap, onClose }: { course: Course; onSwap?: (c: Course) => void; onClose: () => void }) {
  const [summary, setSummary] = useState<CourseSummary | null>(null)
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [grades, setGrades] = useState<GradeDistributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.courses.get(course.code),
      api.courses.reviews(course.code, 1, 3),
      api.courses.gradeDistribution(course.code),
    ])
      .then(([sum, revs, dist]) => {
        if (cancelled) {
          return
        }
        setSummary(sum.data)
        setReviews(revs.data)
        setGrades(dist.data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load course data.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [course.code])

  const barColors = ['#4338CA', '#6366F1', '#A5B4FC', '#C7D2FE', '#E0E7FF']

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 560, maxHeight: '85vh', background: '#FFFFFF' }}
      >
        {/* Header */}
        <div className="px-6 py-5" style={{ background: course.colorLight, borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="rounded-md px-2 py-0.5"
                  style={{ fontSize: 11, fontWeight: 700, background: course.color, color: 'white', letterSpacing: '0.05em' }}
                >
                  {course.code}
                </span>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Section {course.section}</span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{course.name}</h2>
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{course.professor}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 transition-colors" style={{ color: '#64748B' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
              <Clock size={12} />{courseStartTime(course)} – {courseEndTime(course)}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
              <MapPin size={12} />{course.room || '—'}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
              <BookOpen size={12} />{course.credits} credits
            </span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error && (
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
              {error}
            </div>
          )}
          {loading && (
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>Loading course data...</div>
          )}

          {!loading && summary && (
            <>
              {/* Ratings row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Overall Rating', value: summary.averageRating === null ? '—' : summary.averageRating.toFixed(1), sub: 'out of 5', color: '#4338CA' },
                  { label: 'Difficulty', value: summary.averageDifficulty === null ? '—' : summary.averageDifficulty.toFixed(1), sub: 'out of 5', color: '#D97706' },
                  { label: 'Would Retake', value: summary.wouldRetakePercentage === null ? '—' : `${Math.round(summary.wouldRetakePercentage)}%`, sub: 'of students', color: '#059669' },
                ].map((r) => (
                  <div key={r.label} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: r.color }}>{r.value}</div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{r.sub}</div>
                  </div>
                ))}
              </div>

              {/* Grade distribution */}
              {grades.length > 0 && (
                <div className="mb-5">
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Grade Distribution</div>
                  <div className="flex items-end gap-2" style={{ height: 60 }}>
                    {grades.map((g, i) => (
                      <div key={g.grade} className="flex-1 flex flex-col items-center gap-1">
                        <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>{g.percentage ?? 0}%</div>
                        <div
                          className="w-full rounded-t-md"
                          style={{ height: `${(g.percentage ?? 0) * 1.2}px`, background: barColors[i % barColors.length] }}
                        />
                        <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>{g.grade}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Student Reviews</div>
                <div className="flex flex-col gap-3">
                  {reviews.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8' }}>No reviews yet.</div>}
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{displayName(r.author?.firstName, r.author?.lastName)}</span>
                          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>{timeAgo(r.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <Star key={j} size={11} fill={j < r.rating ? '#F59E0B' : 'none'} color={j < r.rating ? '#F59E0B' : '#CBD5E1'} />
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{r.comment || 'No comment.'}</p>
                      {r.difficulty !== null && (
                        <div className="flex gap-1.5 mt-2">
                          <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
                            Difficulty {r.difficulty}/5
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: '#EEF2FF', color: '#4338CA' }}
          >
            View Full Reviews
          </button>
          {onSwap && (
            <button
              onClick={() => onSwap(course)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)' }}
            >
              Replace Section
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ----- Section Picker Modal -----
function SectionPickerModal({
  title,
  code,
  currentSection,
  onPick,
  onClose,
}: {
  title: string
  code: string
  currentSection?: string
  onPick: (sections: CourseSection[]) => void
  onClose: () => void
}) {
  const [sections, setSections] = useState<CourseSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api.courses
      .sections(code)
      .then((res) => {
        if (!cancelled) {
          setSections(res.data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load sections.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [code])

  const groups = groupSectionsByLink(sections)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 520, maxHeight: '85vh', background: '#FFFFFF' }}>
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <span className="rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: '#4338CA', color: 'white' }}>{code}</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{title}</div>
            {currentSection && <div style={{ fontSize: 12, color: '#64748B' }}>Current: Section {currentSection}</div>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-3">
          {error && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
              {error}
            </div>
          )}
          {loading && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Loading sections...</div>}
          {!loading && groups.length === 0 && !error && (
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>No sections available this semester.</div>
          )}
          {groups.map((group) => {
            const primarySec = group.sections[0]!
            const isCurrent = group.sections.some((s) => s.section_number === currentSection)
            const seatsLeft = group.sections.reduce(
              (min, s) => {
                const r = s.seats_total !== null && s.seats_remaining !== null ? s.seats_remaining : null
                return r !== null && r < min ? r : min
              },
              Infinity,
            )
            const seatsLabel = seatsLeft === Infinity ? 'Seats N/A' : `${seatsLeft} seats open`
            const professor = displayName(primarySec.professors?.first_name, primarySec.professors?.last_name) || 'Unknown instructor'

            return (
              <button
                key={group.key}
                onClick={() => onPick(group.sections)}
                className="flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', cursor: isCurrent ? 'default' : 'pointer', opacity: isCurrent ? 0.75 : 1 }}
                onMouseEnter={(e) => { if (!isCurrent) { e.currentTarget.style.border = '1px solid #4338CA50'; e.currentTarget.style.background = '#EEF2FF' } }}
                onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid #F1F5F9'; e.currentTarget.style.background = '#F8FAFC' }}
              >
                <div className="rounded-lg px-2 py-1 shrink-0" style={{ background: '#4338CA20', color: '#4338CA', fontSize: 12, fontWeight: 800 }}>
                  §{primarySec.section_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{professor}</div>
                  <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
                    {sectionGroupSummary(group)}
                  </div>
                  <div style={{ fontSize: 11, color: seatsLeft !== Infinity && seatsLeft > 0 ? '#059669' : '#94A3B8', marginTop: 2 }}>
                    {seatsLabel}
                  </div>
                </div>
                <div className="ml-auto text-xs font-semibold" style={{ color: '#4338CA' }}>{isCurrent ? 'Current' : 'Select →'}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ----- Calendar Column -----
function CalendarColumn({
  dayIndex,
  courses,
  onCourseClick,
  onRemove,
  onChange,
}: {
  dayIndex: number
  courses: Course[]
  onCourseClick: (c: Course) => void
  onRemove?: (id: string) => void
  onChange?: (c: Course) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const dayCourses = courses.filter((c) => c.days.includes(dayIndex))

  return (
    <div className="relative flex-1" style={{ height: HOURS.length * HOUR_HEIGHT }}>
      {/* Hour lines */}
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0"
          style={{ top: (h - START_HOUR) * HOUR_HEIGHT, borderTop: '1px solid #F1F5F9' }}
        />
      ))}
      {/* Half-hour lines */}
      {HOURS.map((h) => (
        <div
          key={`${h}-half`}
          className="absolute left-0 right-0"
          style={{ top: (h - START_HOUR + 0.5) * HOUR_HEIGHT, borderTop: '1px dashed #F8FAFC' }}
        />
      ))}

      {dayCourses.map((course) => {
        const top = courseTop(course)
        const height = courseHeight(course)
        const hovered = hoveredId === course.id

        return (
          <div
            key={course.id}
            className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer transition-all duration-150"
            style={{
              top,
              height,
              background: course.color,
              opacity: hovered ? 1 : 0.92,
              transform: hovered ? 'scale(1.02)' : 'scale(1)',
              zIndex: hovered ? 10 : 1,
              boxShadow: hovered ? `0 4px 16px ${course.color}40` : 'none',
            }}
            onMouseEnter={() => setHoveredId(course.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onCourseClick(course)}
          >
            <div className="p-1.5 h-full flex flex-col">
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2 }}>{course.code}</div>
              {height > 40 && course.room && (
                <div className="overflow-hidden text-ellipsis" style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, marginTop: 2 }}>
                  {decodeHtmlEntities(course.room)}
                </div>
              )}
            </div>

            {/* Hover actions */}
            {hovered && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg"
                style={{ background: `${course.color}EE` }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: 'white', textAlign: 'center', paddingInline: 4 }}>
                  {course.code}
                </div>
                {[
                  { icon: <Eye size={10} />, label: 'View', action: () => onCourseClick(course) },
                  { icon: <ArrowLeftRight size={10} />, label: 'Change', action: () => onChange ? onChange(course) : onCourseClick(course) },
                  { icon: <Trash2 size={10} />, label: 'Remove', action: () => onRemove ? onRemove(course.id) : undefined, danger: true },
                ].map((a) => (
                  <button
                    key={a.label}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
                    style={{ fontSize: 9, fontWeight: 600, color: 'white', background: a.danger ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.2)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = a.danger ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.35)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = a.danger ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.2)' }}
                    onClick={(e) => { e.stopPropagation(); a.action() }}
                  >
                    {a.icon}{a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ----- Weekly Calendar -----
function WeeklyCalendar({ courses, onCourseClick, onRemove, onChange }: { courses: Course[]; onCourseClick: (c: Course) => void; onRemove?: (id: string) => void; onChange?: (c: Course) => void }) {
  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="flex sticky top-0 z-10" style={{ background: '#FFFFFF', borderBottom: '2px solid #F1F5F9' }}>
        <div style={{ width: 52, flexShrink: 0 }} />
        {DAYS.map((d) => (
          <div key={d} className="flex-1 text-center py-2.5" style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="flex">
        {/* Time labels */}
        <div style={{ width: 52, flexShrink: 0 }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end pr-2"
              style={{ height: HOUR_HEIGHT, paddingTop: 2 }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>{formatHour(h)}</span>
            </div>
          ))}
        </div>
        {/* Day columns */}
        {DAYS.map((_, di) => (
          <CalendarColumn key={di} dayIndex={di} courses={courses} onCourseClick={onCourseClick} onRemove={onRemove} onChange={onChange} />
        ))}
      </div>
    </div>
  )
}

// ----- Preferences Panel -----
type ReqCourse = { code: string; title: string; credits: string; professorRatings: Record<string, number | null> }
interface PriorityWeights { minimizeDays: number; compactDays: number; professorPreference: number }
interface PreferencesPayload {
  semester: string
  requiredCourses: ReqCourse[]
  requiredAttributes: string[]
  electiveCourses: ReqCourse[]
  constraints: { earliestStart: string; latestEnd: string; allowedStudyDays: string[]; maxClassesPerDay: string; minimumBreak: string; avoidBuildings: string[] }
  weights: PriorityWeights
}

function optimizerSectionsToCourses(sections: SelectedSection[]): Course[] {
  const colors = new Map<string, string>()
  return optimizerMeetingOccurrences(sections).map(({ section, meeting, key, dayIndex }) => {
    const courseId = String(section.course_id)
    if (!colors.has(courseId)) colors.set(courseId, COURSE_COLORS[colors.size % COURSE_COLORS.length])
    const [startHour, startMin] = meeting.start.split(':').map(Number)
    const [endHour, endMin] = meeting.end.split(':').map(Number)
    const room = [meeting.building, meeting.room].filter(Boolean).join(' ')
    return {
      id: key, code: section.course_code ?? courseId,
      name: section.course_title ?? '', section: section.section_number ?? '',
      professor: section.professor ? displayName(section.professor.first_name, section.professor.last_name) : '',
      room: room || section.room || '', days: [dayIndex], startHour, startMin,
      durationMin: (endHour * 60 + endMin) - (startHour * 60 + startMin), color: colors.get(courseId)!,
      colorLight: '#EEF2FF', credits: section.credits ?? 0,
      sectionId: typeof section.id === 'number' ? section.id : Number.isFinite(Number(section.id)) ? Number(section.id) : null,
    }
  })
}

const DEFAULT_WEIGHTS: PriorityWeights = { minimizeDays: 34, compactDays: 33, professorPreference: 33 }
const ATTRIBUTES = ['Writing', 'Humanities', 'Natural Science', 'Social Science', 'Quantitative Thought', 'Quantitative Reasoning', 'Engineering', 'Arts']
const BUILDINGS = ['Bechtel', 'Bliss', 'College Hall', 'Hostler', 'Nicely', 'OSB']
const panelCardStyle = { background: '#F8FAFC', border: '1px solid #F1F5F9' }
const fieldStyle = { fontSize: 11, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#374151' }

function SearchableCourseSelect({ exclude, onSelect, placeholder = 'Search course code or title...' }: { exclude: string[]; onSelect: (course: CourseSummary) => void; placeholder?: string }) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CourseSummary[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      api.courses.list({ search: query.trim() || undefined, limit: 20 })
        .then((res) => { if (!cancelled) setOptions(res.data.filter((c) => !exclude.includes(c.code))) })
        .catch(() => { if (!cancelled) setOptions([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, open, exclude.join('|')])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={fieldStyle}>
        <Search size={12} color="#94A3B8" />
        <input value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          placeholder={placeholder} className="flex-1 min-w-0 outline-none bg-transparent" style={{ fontSize: 11 }} />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-y-auto shadow-xl z-30" style={{ maxHeight: 190, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {loading && <div className="p-3 text-center" style={{ fontSize: 10, color: '#94A3B8' }}>Searching real courses...</div>}
          {!loading && options.length === 0 && <div className="p-3 text-center" style={{ fontSize: 10, color: '#94A3B8' }}>No matching courses</div>}
          {!loading && options.map((course) => (
            <button key={course.id} className="w-full text-left px-3 py-2 hover:bg-slate-50" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(course); setQuery(''); setOpen(false) }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary, #4338CA)' }}>{course.code} <span style={{ color: '#94A3B8', fontWeight: 500 }}>· {course.credits} cr</span></div>
              <div className="truncate" style={{ fontSize: 10, color: '#64748B' }}>{course.title}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CoursePreferenceCard({ course, onChange, onRemove }: { course: ReqCourse; onChange: (course: ReqCourse) => void; onRemove: () => void }) {
  const [professors, setProfessors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setFailed(false)
    api.courses.sections(course.code)
      .then((res) => {
        if (cancelled) return
        const names = [...new Set(res.data.map((section) => displayName(section.professors?.first_name, section.professors?.last_name)).filter(Boolean))]
        setProfessors(names)
      })
      .catch(() => { if (!cancelled) { setProfessors([]); setFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [course.code])

  const setRating = (professor: string, rating: number | null) => onChange({ ...course, professorRatings: { ...course.professorRatings, [professor]: rating } })
  return (
    <div className="rounded-xl p-2.5" style={{ background: 'var(--color-primary-light, #EEF2FF)', border: '1px solid var(--color-primary-border, #C7D2FE)' }}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0"><div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary, #4338CA)' }}>{course.code}</div><div className="truncate" style={{ fontSize: 10, color: '#64748B' }}>{course.title}</div></div>
        <span style={{ fontSize: 10, color: '#64748B' }}>{course.credits} cr</span>
        <button onClick={onRemove} title={`Remove ${course.code}`} style={{ color: '#818CF8' }}><X size={13} /></button>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginTop: 9, marginBottom: 4 }}>Professor preferences</div>
      {loading && <div style={{ fontSize: 10, color: '#94A3B8' }}>Loading professors...</div>}
      {!loading && professors.length === 0 && <div style={{ fontSize: 10, color: failed ? '#B45309' : '#94A3B8' }}>Professor data will appear when available.</div>}
      {!loading && professors.map((professor) => {
        const rating = course.professorRatings[professor] ?? null
        return <div key={professor} className="flex items-center gap-1 py-0.5">
          <span className="flex-1 truncate" style={{ fontSize: 10, color: '#374151' }}>{professor}</span>
          {[1, 2, 3, 4, 5].map((value) => <button key={value} title={`${value} star${value === 1 ? '' : 's'}`} onClick={() => setRating(professor, value)}><Star size={12} fill={rating !== null && value <= rating ? '#F59E0B' : 'transparent'} color={rating !== null && value <= rating ? '#F59E0B' : '#CBD5E1'} /></button>)}
          {rating !== null && <button onClick={() => setRating(professor, null)} style={{ fontSize: 9, color: '#64748B', marginLeft: 2 }}>Clear</button>}
        </div>
      })}
    </div>
  )
}

function PreferencesPanel({ onGenerate, onChanged, onCreditsChange }: { onGenerate: (payload: PreferencesPayload) => void; onChanged: () => void; onCreditsChange: (credits: number) => void }) {
  const [semester, setSemester] = useState('Fall 2025')
  const [requiredCourses, setRequiredCourses] = useState<ReqCourse[]>([])
  const [electiveCourses, setElectiveCourses] = useState<ReqCourse[]>([])
  const [requiredAttributes, setRequiredAttributes] = useState<string[]>([])
  const [earliestStart, setEarliestStart] = useState('9:00 AM')
  const [latestEnd, setLatestEnd] = useState('6:00 PM')
  const [allowedStudyDays, setAllowedStudyDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [maxClassesPerDay, setMaxClassesPerDay] = useState('3')
  const [minimumBreak, setMinimumBreak] = useState('30 min')
  const [avoidBuildings, setAvoidBuildings] = useState<string[]>([])
  const [weights, setWeights] = useState<PriorityWeights>(DEFAULT_WEIGHTS)

  useEffect(() => {
    onCreditsChange([...requiredCourses, ...electiveCourses].reduce((total, course) => total + (Number.parseFloat(course.credits) || 0), 0))
  }, [requiredCourses, electiveCourses, onCreditsChange])

  const notify = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => { setter(value); onChanged() }
  const addCourse = (course: CourseSummary, elective: boolean) => {
    const item: ReqCourse = { code: course.code, title: course.title, credits: course.credits, professorRatings: {} }
    notify(elective ? setElectiveCourses : setRequiredCourses, (prev) => [...prev, item])
  }
  const updateWeight = (key: keyof PriorityWeights, value: number) => {
    const others = (Object.keys(weights) as (keyof PriorityWeights)[]).filter((item) => item !== key)
    const remaining = 100 - value
    const oldRemaining = weights[others[0]] + weights[others[1]]
    const first = oldRemaining === 0 ? Math.floor(remaining / 2) : Math.round(remaining * weights[others[0]] / oldRemaining)
    setWeights({ ...weights, [key]: value, [others[0]]: first, [others[1]]: remaining - first })
    onChanged()
  }
  const reset = () => {
    setSemester('Fall 2025'); setRequiredCourses([]); setElectiveCourses([]); setRequiredAttributes([])
    setEarliestStart('9:00 AM'); setLatestEnd('6:00 PM'); setAllowedStudyDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    setMaxClassesPerDay('3'); setMinimumBreak('30 min'); setAvoidBuildings([]); setWeights(DEFAULT_WEIGHTS); onChanged()
  }
  const generate = () => onGenerate({ semester, requiredCourses, requiredAttributes, electiveCourses, constraints: { earliestStart, latestEnd, allowedStudyDays, maxClassesPerDay, minimumBreak, avoidBuildings }, weights })
  const sectionTitle = (number: number, title: string) => <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{number} — {title}</div>
  const toggle = (value: string, values: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => notify(setter, values.includes(value) ? values.filter((item) => item !== value) : [...values, value])

  return <div className="h-full overflow-y-auto flex flex-col gap-3 p-4 shrink-0" style={{ width: 300, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}>
    <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Schedule Preferences</div>
    <div className="rounded-xl p-3" style={panelCardStyle}>{sectionTitle(1, 'Semester')}<select value={semester} onChange={(e) => notify(setSemester, e.target.value)} className="w-full rounded-lg px-2.5 py-2 outline-none" style={fieldStyle}>{['Fall 2025', 'Spring 2026', 'Fall 2026', 'Spring 2027'].map((term) => <option key={term}>{term}</option>)}</select></div>
    <div className="rounded-xl p-3 flex flex-col gap-2" style={panelCardStyle}>{sectionTitle(2, 'Required Courses')}
      {requiredCourses.map((course, index) => <CoursePreferenceCard key={course.code} course={course} onChange={(next) => notify(setRequiredCourses, requiredCourses.map((item, i) => i === index ? next : item))} onRemove={() => notify(setRequiredCourses, requiredCourses.filter((_, i) => i !== index))} />)}
      <SearchableCourseSelect exclude={[...requiredCourses, ...electiveCourses].map((c) => c.code)} onSelect={(course) => addCourse(course, false)} />
    </div>
    <div className="rounded-xl p-3 flex flex-col gap-2" style={panelCardStyle}>{sectionTitle(3, 'Electives')}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Required attributes</div>
      <div className="flex flex-wrap gap-1">{ATTRIBUTES.map((attribute) => { const selected = requiredAttributes.includes(attribute); return <button key={attribute} onClick={() => toggle(attribute, requiredAttributes, setRequiredAttributes)} className="rounded-full px-2 py-1" style={{ fontSize: 9, fontWeight: 700, background: selected ? 'var(--color-primary, #4338CA)' : '#FFFFFF', color: selected ? '#FFFFFF' : '#64748B', border: `1px solid ${selected ? 'var(--color-primary, #4338CA)' : '#E2E8F0'}` }}>{attribute}</button> })}</div>
      {electiveCourses.map((course, index) => <CoursePreferenceCard key={course.code} course={course} onChange={(next) => notify(setElectiveCourses, electiveCourses.map((item, i) => i === index ? next : item))} onRemove={() => notify(setElectiveCourses, electiveCourses.filter((_, i) => i !== index))} />)}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginTop: 3 }}>Add Specific Elective</div><SearchableCourseSelect exclude={[...requiredCourses, ...electiveCourses].map((c) => c.code)} onSelect={(course) => addCourse(course, true)} />
    </div>
    <div className="rounded-xl p-3" style={panelCardStyle}>{sectionTitle(4, 'Schedule Constraints')}
      <div className="grid grid-cols-2 gap-2">{[
        ['Earliest start', earliestStart, setEarliestStart, ['7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM']], ['Latest end', latestEnd, setLatestEnd, ['3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM']],
        ['Max classes/day', maxClassesPerDay, setMaxClassesPerDay, ['1','2','3','4','5']], ['Min break', minimumBreak, setMinimumBreak, ['No minimum','15 min','30 min','45 min','1 hour']],
      ].map(([label, value, setter, options]) => <label key={label as string}><span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8' }}>{label as string}</span><select value={value as string} onChange={(e) => notify(setter as React.Dispatch<React.SetStateAction<string>>, e.target.value)} className="w-full rounded-lg px-2 py-1.5 outline-none" style={fieldStyle}>{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginTop: 9, marginBottom: 4 }}>Allowed study days</div><div className="flex flex-wrap gap-1">{DAYS.map((day) => { const selected = allowedStudyDays.includes(day); return <button key={day} onClick={() => toggle(day, allowedStudyDays, setAllowedStudyDays)} className="rounded-full px-2.5 py-1" style={{ fontSize: 10, fontWeight: 700, background: selected ? 'var(--color-primary, #4338CA)' : '#FFFFFF', color: selected ? '#FFFFFF' : '#64748B', border: `1px solid ${selected ? 'var(--color-primary, #4338CA)' : '#E2E8F0'}` }}>{day}</button> })}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginTop: 9, marginBottom: 4 }}>Buildings to avoid</div><div className="flex flex-wrap gap-1">{BUILDINGS.map((building) => { const selected = avoidBuildings.includes(building); return <button key={building} onClick={() => toggle(building, avoidBuildings, setAvoidBuildings)} className="rounded-full px-2 py-1" style={{ fontSize: 9, fontWeight: 700, background: selected ? '#FEE2E2' : '#FFFFFF', color: selected ? '#B91C1C' : '#64748B', border: `1px solid ${selected ? '#FCA5A5' : '#E2E8F0'}` }}>{building}</button> })}</div>
    </div>
    <div className="rounded-xl p-3" style={panelCardStyle}>{sectionTitle(5, 'Your Priorities')}
      {([['minimizeDays','Minimize days on campus'],['compactDays','Shorter, compact days'],['professorPreference','Professor preference']] as [keyof PriorityWeights,string][]).map(([key,label]) => <div key={key} className="mb-2"><div className="flex justify-between" style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}><span>{label}</span><span>{weights[key]}%</span></div><input type="range" min="0" max="100" value={weights[key]} onChange={(e) => updateWeight(key, Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--color-primary, #4338CA)' }} /></div>)}
      <div className="grid grid-cols-3 gap-1">{Object.values(weights).map((value, index) => <div key={index} className="rounded-lg py-1.5 text-center" style={{ background: 'var(--color-primary-light, #EEF2FF)', fontSize: 10, fontWeight: 800, color: 'var(--color-primary, #4338CA)' }}>{value}%</div>)}</div>
    </div>
    <button onClick={generate} className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--color-primary-grad, linear-gradient(135deg, #4338CA, #6366F1))', color: '#FFFFFF', fontSize: 13 }}><Sparkles size={14} />Generate Schedule</button>
    <button onClick={reset} className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-2" style={{ background: '#F1F5F9', color: '#64748B', fontSize: 13 }}><RotateCcw size={13} />Reset Preferences</button>
  </div>
}

const DEFAULT_OPTIMIZER_FORM: OptimizerFormState = {
  termId: null, requiredCourses: [], acceptableElectives: [], selectedAttributeIds: [], creditMode: 'exact',
  exactCredits: 15, minCredits: 12, maxCredits: 18, weights: { days: 34, gaps: 33, professor: 33 }, professorPreferences: {}, excludedSectionIds: [],
}

function OptimizerSearch({ termId, excludedIds, onPick }: { termId: number | null; excludedIds: number[]; onPick: (course: CourseOption) => void }) {
  const [query, setQuery] = useState(''); const [courses, setCourses] = useState<CourseOption[]>([]); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false)
  const latest = useRef(0)
  useEffect(() => {
    if (!open || termId == null) { setCourses([]); return }
    const id = ++latest.current; let cancelled = false; setLoading(true)
    const timer = setTimeout(() => { api.schedules.optimizerCourses(termId, query.trim()).then((data) => { if (!cancelled && id === latest.current) setCourses(data.filter((course) => !excludedIds.includes(course.id))) }).catch(() => { if (!cancelled && id === latest.current) setCourses([]) }).finally(() => { if (!cancelled && id === latest.current) setLoading(false) }) }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, open, termId, excludedIds.join('|')])
  return <div className="relative"><div className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={fieldStyle}><Search size={12} color="#94A3B8" /><input disabled={termId == null} value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} placeholder={termId == null ? 'Select a term first' : 'Search offered courses...'} className="flex-1 min-w-0 outline-none bg-transparent" /></div>{open && termId != null && <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-y-auto shadow-xl z-30" style={{ maxHeight: 190, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>{loading ? <div className="p-3 text-center text-xs">Searching...</div> : courses.length === 0 ? <div className="p-3 text-center text-xs">No matching courses</div> : courses.map((course) => <button key={course.id} className="w-full text-left px-3 py-2 hover:bg-slate-50" onClick={() => { onPick(course); setQuery(''); setOpen(false) }}><div style={{ fontSize: 11, fontWeight: 800 }}>{course.code}</div><div className="truncate" style={{ fontSize: 10, color: '#64748B' }}>{course.title} — {course.credits} credits</div></button>)}</div>}</div>
}

function OptimizerCourseRow({ course, ratings, onRate, onRemove }: { course: CourseOption; ratings: Record<string, number>; onRate: (id: number, value: number | null) => void; onRemove: () => void }) {
  return <div className="rounded-xl p-2.5" style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)' }}><div className="flex gap-2"><div className="flex-1 min-w-0"><b style={{ fontSize: 11 }}>{course.code}</b><div className="truncate" style={{ fontSize: 10, color: '#64748B' }}>{course.title}</div></div><span style={{ fontSize: 10 }}>{course.credits} cr</span><button onClick={onRemove}><X size={13} /></button></div>{course.professors.map((professor) => { const rating = ratings[String(professor.id)] ?? null; return <div key={professor.id} className="flex items-center gap-1 mt-1"><span className="flex-1 truncate" style={{ fontSize: 10 }}>{displayName(professor.first_name, professor.last_name)}</span>{[1,2,3,4,5].map((value) => <button key={value} onClick={() => onRate(professor.id, value)}><Star size={11} fill={rating != null && value <= rating ? '#F59E0B' : 'transparent'} color={rating != null && value <= rating ? '#F59E0B' : '#CBD5E1'} /></button>)}{rating != null && <button onClick={() => onRate(professor.id, null)} style={{ fontSize: 9 }}>Clear</button>}</div> })}</div>
}

function OptimizerPreferences({ form, setForm, terms, attributes, loading, optimizing, error, onGenerate }: { form: OptimizerFormState; setForm: React.Dispatch<React.SetStateAction<OptimizerFormState>>; terms: TermOption[]; attributes: AttributeOption[]; loading: boolean; optimizing: boolean; error: string | null; onGenerate: () => void }) {
  const allIds = [...form.requiredCourses, ...form.acceptableElectives].map((course) => course.id)
  const requiredCredits = form.requiredCourses.reduce((sum, course) => sum + course.credits, 0)
  const rate = (id: number, value: number | null) => setForm((current) => { const professorPreferences = { ...current.professorPreferences }; if (value == null) delete professorPreferences[String(id)]; else professorPreferences[String(id)] = value; return { ...current, professorPreferences } })
  const updateWeight = (key: keyof OptimizerFormState['weights'], value: number) => { const others = (Object.keys(form.weights) as (keyof OptimizerFormState['weights'])[]).filter((candidate) => candidate !== key); const remaining = 100 - value; const old = form.weights[others[0]] + form.weights[others[1]]; const first = old === 0 ? Math.floor(remaining / 2) : Math.round(remaining * form.weights[others[0]] / old); setForm((current) => ({ ...current, weights: { ...current.weights, [key]: value, [others[0]]: first, [others[1]]: remaining - first } })) }
  const title = (value: string) => <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 7 }}>{value}</div>
  const card = 'rounded-xl p-3 flex flex-col gap-2'
  return <div className="h-full overflow-y-auto flex flex-col gap-3 p-4 shrink-0" style={{ width: 300, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}><b>Schedule Preferences</b>
    <div className={card} style={panelCardStyle}>{title('1 — Planning Term')}<select disabled={loading} value={form.termId ?? ''} onChange={(e) => setForm({ ...DEFAULT_OPTIMIZER_FORM, termId: e.target.value ? Number(e.target.value) : null })} style={fieldStyle}><option value="">{loading ? 'Loading terms...' : 'Select a term'}</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></div>
    <div className={card} style={panelCardStyle}>{title('2 — Required Courses')}{form.requiredCourses.map((course) => <OptimizerCourseRow key={course.id} course={course} ratings={form.professorPreferences} onRate={rate} onRemove={() => setForm((current) => ({ ...current, requiredCourses: current.requiredCourses.filter((item) => item.id !== course.id) }))} />)}<OptimizerSearch key={`required-${form.termId ?? 'none'}`} termId={form.termId} excludedIds={allIds} onPick={(course) => setForm((current) => ({ ...current, requiredCourses: [...current.requiredCourses, course] }))} /></div>
    <div className={card} style={panelCardStyle}>{title('3 — Acceptable Electives')}{form.acceptableElectives.map((course) => <OptimizerCourseRow key={course.id} course={course} ratings={form.professorPreferences} onRate={rate} onRemove={() => setForm((current) => ({ ...current, acceptableElectives: current.acceptableElectives.filter((item) => item.id !== course.id) }))} />)}<OptimizerSearch key={`elective-${form.termId ?? 'none'}`} termId={form.termId} excludedIds={allIds} onPick={(course) => setForm((current) => ({ ...current, acceptableElectives: [...current.acceptableElectives, course] }))} /></div>
    <div className={card} style={panelCardStyle}>{title('4 — Credit Load')}<div className="flex gap-2">{(['exact','range'] as const).map((mode) => <button key={mode} onClick={() => setForm((current) => ({ ...current, creditMode: mode }))} className="rounded-lg px-2 py-1" style={{ background: form.creditMode === mode ? 'var(--color-primary)' : '#FFFFFF', color: form.creditMode === mode ? '#FFFFFF' : '#64748B' }}>{mode}</button>)}</div>{form.creditMode === 'exact' ? <input aria-label="Exact credits" type="number" min="0" value={form.exactCredits} onChange={(e) => setForm((current) => ({ ...current, exactCredits: Number(e.target.value) }))} style={fieldStyle} /> : <div className="grid grid-cols-2 gap-2"><input aria-label="Minimum credits" type="number" min="0" value={form.minCredits} onChange={(e) => setForm((current) => ({ ...current, minCredits: Number(e.target.value) }))} style={fieldStyle} /><input aria-label="Maximum credits" type="number" min="0" value={form.maxCredits} onChange={(e) => setForm((current) => ({ ...current, maxCredits: Number(e.target.value) }))} style={fieldStyle} /></div>}<span style={{ fontSize: 10, color: '#64748B' }}>Required: {requiredCredits} credits. You need at least {Math.max(0, (form.creditMode === 'exact' ? form.exactCredits : form.minCredits) - requiredCredits)} elective credits.</span></div>
    <div className={card} style={panelCardStyle}>{title('5 — Required Attributes')}<span style={{ fontSize: 9, color: '#64748B' }}>At least one final course must satisfy each selected attribute.</span><div className="flex flex-wrap gap-1">{attributes.map((attribute) => { const selected = form.selectedAttributeIds.includes(attribute.id); return <button key={attribute.id} onClick={() => setForm((current) => ({ ...current, selectedAttributeIds: selected ? current.selectedAttributeIds.filter((id) => id !== attribute.id) : [...current.selectedAttributeIds, attribute.id] }))} className="rounded-full px-2 py-1" style={{ fontSize: 9, background: selected ? 'var(--color-primary)' : '#FFFFFF', color: selected ? '#FFFFFF' : '#64748B' }}>{attribute.name}</button> })}</div></div>
    <div className={card} style={panelCardStyle}>{title('6 — Priorities')}{([['days','Minimize days'],['gaps','Shorter gaps'],['professor','Professor preference']] as [keyof OptimizerFormState['weights'],string][]).map(([key,label]) => <label key={key} style={{ fontSize: 10 }}><span className="flex justify-between"><b>{label}</b><b>{form.weights[key]}%</b></span><input type="range" min="0" max="100" value={form.weights[key]} onChange={(e) => updateWeight(key, Number(e.target.value))} className="w-full" /></label>)}</div>
    {error && <div className="rounded-lg p-2" style={{ fontSize: 10, color: '#B91C1C', background: '#FEF2F2' }}>{error}</div>}<button disabled={optimizing} onClick={onGenerate} className="rounded-xl py-2.5 text-white font-semibold" style={{ background: 'var(--color-primary)', opacity: optimizing ? .6 : 1 }}>{optimizing ? 'Optimizing...' : 'Generate Schedule'}</button><button onClick={() => setForm(DEFAULT_OPTIMIZER_FORM)} className="rounded-xl py-2">Reset Preferences</button>
  </div>
}

// ----- AI Assistant Panel -----
interface Message {
  role: 'user' | 'ai'
  text: string
  timestamp: string
}

const INITIAL_MESSAGES: Message[] = []

const EXAMPLE_PROMPTS = [
  "Give me Fridays off",
  "Only professors rated above 4.5",
  "No classes before 10 AM",
  "I need one humanities elective",
]

function AIAssistantPanel({ onGenerate }: { onGenerate: () => void }) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiName, setAiName] = useState('AI Assistant')
  const [editingName, setEditingName] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}`,
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', text: input, timestamp: 'now' }
    setMessages((p) => [...p, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await api.assistant.chat(input, sessionId)
      setMessages((p) => [...p, {
        role: 'ai',
        text: res.data.response,
        timestamp: 'now',
      }])
      onGenerate()
    } catch {
      setMessages((p) => [...p, {
        role: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: 'now',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: 300, background: '#FFFFFF', borderLeft: '1px solid #F1F5F9' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="rounded-lg p-1.5" style={{ background: 'var(--color-primary-grad, linear-gradient(135deg, #4338CA, #6366F1))' }}>
          <Sparkles size={13} color="white" />
        </div>
        {editingName ? (
          <input autoFocus value={aiName} onChange={(e) => setAiName(e.target.value)}
            onBlur={() => { setAiName((name) => name.trim() || 'AI Assistant'); setEditingName(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="flex-1 rounded-md px-2 py-1 outline-none" style={{ fontSize: 13, fontWeight: 700, border: '1px solid var(--color-primary-border, #C7D2FE)' }} />
        ) : <div className="flex-1" style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{aiName}</div>}
        <button onClick={() => setEditingName(true)} title="Edit assistant name" style={{ color: '#94A3B8' }}><Pencil size={12} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className="shrink-0 rounded-full flex items-center justify-center"
              style={{
                width: 26, height: 26,
                background: m.role === 'ai' ? 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)' : '#EEF2FF',
              }}
            >
              {m.role === 'ai' ? <Bot size={13} color="white" /> : <User size={13} color="#4338CA" />}
            </div>
            <div
              className="rounded-2xl px-3 py-2 max-w-[200px]"
              style={{
                background: m.role === 'user' ? '#4338CA' : '#F8FAFC',
                color: m.role === 'user' ? 'white' : '#374151',
                fontSize: 12,
                lineHeight: 1.6,
                borderBottomLeftRadius: m.role === 'ai' ? 4 : 16,
                borderBottomRightRadius: m.role === 'user' ? 4 : 16,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="shrink-0 rounded-full flex items-center justify-center"
              style={{ width: 26, height: 26, background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)' }}>
              <Bot size={13} color="white" />
            </div>
            <div className="rounded-2xl px-3 py-2 flex items-center gap-1" style={{ background: '#F8FAFC' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-full animate-bounce"
                  style={{ width: 6, height: 6, background: '#94A3B8', animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-2 flex flex-col gap-2">
        <div className="rounded-xl p-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#1D4ED8', marginBottom: 3 }}>Reasoning</div>
          <div style={{ fontSize: 10, lineHeight: 1.5, color: '#475569' }}>Schedule reasoning will appear here when generation results are available.</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#334155', marginBottom: 3 }}>Trade-offs</div>
          <div style={{ fontSize: 10, lineHeight: 1.5, color: '#64748B' }}>No generated schedule is available to evaluate yet.</div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-3 mb-2">
        <div className="flex flex-wrap gap-1">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setInput(p)}
              className="rounded-full px-2.5 py-1 transition-colors"
              style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#4338CA' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 mb-2 flex gap-1.5">
        {[
          { icon: <RotateCcw size={11} />, label: 'Regenerate', fn: onGenerate },
          { icon: <Zap size={11} />, label: 'Optimize', fn: onGenerate },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-colors"
            style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#4338CA' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B' }}
          >
            {b.icon}{b.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
            placeholder="Ask me anything..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontSize: 12, color: '#374151' }}
          />
          <button
            onClick={sendMessage}
            className="rounded-lg p-1.5 transition-colors"
            style={{ background: input.trim() ? '#4338CA' : '#E2E8F0', color: input.trim() ? 'white' : '#94A3B8' }}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ----- Manual Builder -----
function ManualBuilder({
  courses,
  setCourses,
}: {
  courses: Course[]
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [available, setAvailable] = useState<CourseSummary[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [viewCourse, setViewCourse] = useState<Course | null>(null)
  const [picking, setPicking] = useState<{ code: string; title: string; credits: number } | null>(null)
  const [changeCourse, setChangeCourse] = useState<Course | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSearchLoading(true)
    const timer = setTimeout(() => {
      api.courses
        .list({ search: searchTerm.trim() || undefined, limit: 20 })
        .then((res) => {
          if (!cancelled) {
            setAvailable(res.data)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAvailable([])
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchLoading(false)
          }
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm])

  const handleRemove = (id: string) => {
    setCourses((p) => p.filter((c) => c.id !== id))
  }

  let colorIndex = courses.length

  const buildCourseFromMeeting = (
    src: { code: string; title: string; credits: number },
    sec: CourseSection,
    meeting: { days: number[]; startTime: string | null; endTime: string | null; room: string | null; building: string | null; meetingType: string | null },
    label: string,
  ): Course => {
    const color = COURSE_COLORS[colorIndex % COURSE_COLORS.length]
    colorIndex++
    const start = parseTime(meeting.startTime)
    const end = parseTime(meeting.endTime)
    const roomStr = meeting.building && meeting.room ? `${meeting.building} ${meeting.room}` : (meeting.room ?? sec.room ?? '')
    return {
      id: `sec-${sec.id}-mt-${label}`,
      code: src.code,
      name: src.title,
      section: `${sec.section_number} ${label}`.trim(),
      professor: displayName(sec.professors?.first_name, sec.professors?.last_name),
      room: roomStr,
      days: meeting.days,
      startHour: start?.hours ?? START_HOUR,
      startMin: start?.minutes ?? 0,
      durationMin: start && end ? durationMinutes(meeting.startTime, meeting.endTime) : 0,
      color,
      colorLight: color + '15',
      credits: src.credits,
      sectionId: sec.id,
    }
  }

  const buildCourseFromSection = (
    src: { code: string; title: string; credits: number },
    sec: CourseSection,
  ): Course => {
    const meetings = sec.section_meetings ?? []
    if (meetings.length > 0) {
      const mt = meetings[0]!
      return buildCourseFromMeeting(src, sec, {
        days: meetingDaysToNumbers(mt),
        startTime: mt.start_time,
        endTime: mt.end_time,
        room: mt.room,
        building: mt.building,
        meetingType: mt.meeting_type,
      }, mt.meeting_type ?? '')
    }
    const color = COURSE_COLORS[colorIndex % COURSE_COLORS.length]
    colorIndex++
    const start = parseTime(sec.start_time)
    const end = parseTime(sec.end_time)
    return {
      id: `sec-${sec.id}`,
      code: src.code,
      name: src.title,
      section: sec.section_number,
      professor: displayName(sec.professors?.first_name, sec.professors?.last_name),
      room: sec.room ?? '',
      days: parseDays(sec.days),
      startHour: start?.hours ?? START_HOUR,
      startMin: start?.minutes ?? 0,
      durationMin: start && end ? durationMinutes(sec.start_time, sec.end_time) : 0,
      color,
      colorLight: color + '15',
      credits: src.credits,
      sectionId: sec.id,
    }
  }

  const handlePick = (pickedSections: CourseSection[]) => {
    if (!picking) return
    const newCourses: Course[] = []
    let hasPlacementIssue = false

    for (const sec of pickedSections) {
      const meetings = sec.section_meetings ?? []
      if (meetings.length > 0) {
        for (const mt of meetings) {
          const c = buildCourseFromMeeting(picking, sec, {
            days: meetingDaysToNumbers(mt),
            startTime: mt.start_time,
            endTime: mt.end_time,
            room: mt.room,
            building: mt.building,
            meetingType: mt.meeting_type,
          }, mt.meeting_type ?? '')
          if (c.days.length === 0 || c.durationMin <= 0) hasPlacementIssue = true
          newCourses.push(c)
        }
      } else {
        const c = buildCourseFromSection(picking, sec)
        if (c.days.length === 0 || c.durationMin <= 0) hasPlacementIssue = true
        newCourses.push(c)
      }
    }

    if (hasPlacementIssue) {
      setNotice('Some meetings were added but their meeting time is not available for calendar placement.')
    }
    setCourses((p) => [...p, ...newCourses])
    setPicking(null)
  }

  const handleSwap = (target: Course, swapSections: CourseSection[]) => {
    const newCourses: Course[] = []
    for (const sec of swapSections) {
      const meetings = sec.section_meetings ?? []
      if (meetings.length > 0) {
        for (const mt of meetings) {
          newCourses.push(buildCourseFromMeeting(
            { code: target.code, title: target.name, credits: target.credits },
            sec,
            {
              days: meetingDaysToNumbers(mt),
              startTime: mt.start_time,
              endTime: mt.end_time,
              room: mt.room,
              building: mt.building,
              meetingType: mt.meeting_type,
            },
            mt.meeting_type ?? '',
          ))
        }
      } else {
        newCourses.push(buildCourseFromSection(
          { code: target.code, title: target.name, credits: target.credits },
          sec,
        ))
      }
    }
    setCourses((p) => {
      const without = p.filter((c) => c.id !== target.id)
      return [...without, ...newCourses]
    })
    setChangeCourse(null)
  }

  const totalCredits = courses.reduce((acc, c) => acc + c.credits, 0)

  return (
    <div className="flex h-full">
      {/* Course search panel */}
      <div className="flex flex-col h-full overflow-y-auto" style={{ width: 264, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}>
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Available Courses</div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Search size={13} color="#94A3B8" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, CRN, professor, attribute"
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 12, color: '#374151' }}
            />
          </div>
        </div>
        <div className="flex-1 p-3 flex flex-col gap-2 overflow-y-auto">
          {searchLoading && <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>Searching...</div>}
          {!searchLoading && available.length === 0 && (
            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No courses found. Try another search.</div>
          )}
          {available.map((c, i) => {
            const color = COURSE_COLORS[i % COURSE_COLORS.length]
            const alreadyAdded = courses.some((m) => m.code === c.code)
            return (
              <div
                key={c.code}
                draggable
                className="flex items-center gap-2.5 rounded-xl p-3 transition-all"
                style={{ background: alreadyAdded ? color + '10' : '#F8FAFC', border: `1px solid ${alreadyAdded ? color + '40' : '#F1F5F9'}`, cursor: alreadyAdded ? 'default' : 'grab', opacity: alreadyAdded ? 0.7 : 1 }}
                onMouseEnter={(e) => { if (!alreadyAdded) { e.currentTarget.style.border = `1px solid ${color}40`; e.currentTarget.style.background = '#FFFFFF' } }}
                onMouseLeave={(e) => { if (!alreadyAdded) { e.currentTarget.style.border = '1px solid #F1F5F9'; e.currentTarget.style.background = '#F8FAFC' } }}
              >
                <GripVertical size={12} color="#CBD5E1" />
                <div className="rounded-md" style={{ width: 28, height: 28, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={12} color={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 11, fontWeight: 700, color }}>{c.code}</div>
                  <div style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                </div>
                {alreadyAdded ? (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: '#ECFDF5', borderRadius: 4, padding: '1px 4px' }}>Added</span>
                ) : (
                  <button
                    onClick={() => setPicking({ code: c.code, title: c.title, credits: parseInt(c.credits, 10) || 3 })}
                    className="rounded-full p-1 transition-colors"
                    style={{ color, background: color + '15' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = color + '30' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = color + '15' }}>
                    <Plus size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="p-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, textAlign: 'center' }}>
            {courses.length} courses · {totalCredits} credits
          </div>
          {notice && (
            <div className="rounded-lg px-3 py-2 mb-2" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', fontSize: 11, color: '#0284C7', textAlign: 'center' }}>
              {notice}
            </div>
          )}
        </div>
      </div>

      {/* Drop calendar */}
      <div className="flex-1 overflow-auto">
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-2">
            <div className="rounded-lg px-3 py-1.5 flex items-center gap-1.5"
              style={{ background: '#FEF9C3', border: '1px solid #FDE68A' }}>
              <AlertCircle size={12} color="#D97706" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>
                Hover a course block to View, Change section, or Remove it from your schedule.
              </span>
            </div>
          </div>
        </div>
        <WeeklyCalendar
          courses={courses}
          onCourseClick={setViewCourse}
          onRemove={handleRemove}
          onChange={setChangeCourse}
        />
      </div>

      {viewCourse && (
        <CourseModal
          course={viewCourse}
          onSwap={(c) => { setViewCourse(null); setChangeCourse(c) }}
          onClose={() => setViewCourse(null)}
        />
      )}
      {picking && (
        <SectionPickerModal
          title="Pick a section"
          code={picking.code}
          onPick={handlePick}
          onClose={() => setPicking(null)}
        />
      )}
      {changeCourse && (
        <SectionPickerModal
          title="Change Section"
          code={changeCourse.code}
          currentSection={changeCourse.section}
          onPick={(sec) => handleSwap(changeCourse, sec)}
          onClose={() => setChangeCourse(null)}
        />
      )}
    </div>
  )
}

// ----- Main AIScheduler -----
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [message, onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
      style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600, animation: 'none' }}>
      <CheckCircle size={16} color="#10B981" />
      {message}
    </div>
  )
}

export default function AIScheduler({ activeMode, setPage }: { activeMode: Page; setPage: (p: Page) => void }) {
  const [mode, setMode] = useState<'ai' | 'manual'>(activeMode === 'manual-builder' ? 'manual' : 'ai')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [generating, setGenerating] = useState(false)
  const [manualCourses, setManualCourses] = useState<Course[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [activeSchedule, setActiveSchedule] = useState(0)
  const [aiCredits, setAiCredits] = useState(0)
  const [optimizerForm, setOptimizerForm] = useState<OptimizerFormState>(DEFAULT_OPTIMIZER_FORM)
  const [terms, setTerms] = useState<TermOption[]>([])
  const [attributes, setAttributes] = useState<AttributeOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [optimizerResult, setOptimizerResult] = useState<OptimizeScheduleResult | null>(null)
  const optimizerRequest = useRef(0)

  useEffect(() => {
    setMode(activeMode === 'manual-builder' ? 'manual' : 'ai')
    setSelectedCourse(null)
    setGenerating(false)
  }, [activeMode])

  useEffect(() => {
    let cancelled = false
    setLoadingOptions(true)
    api.schedules.optimizerOptions().then((response) => {
      if (!cancelled) { setTerms(response.terms); setAttributes(response.attributes) }
    }).catch((error) => { if (!cancelled) setRequestError(error instanceof Error ? error.message : 'Could not load optimizer options.') }).finally(() => { if (!cancelled) setLoadingOptions(false) })
    return () => { cancelled = true }
  }, [])

  const handleGenerate = async () => {
    if (generating) return
    setFormError(null); setRequestError(null)
    let request
    try { request = buildOptimizeRequest(optimizerForm) } catch (error) { setFormError(error instanceof Error ? error.message : 'Check your preferences.'); return }
    const requestNumber = ++optimizerRequest.current
    setGenerating(true)
    try {
      const result = await api.schedules.optimize(request)
      if (requestNumber !== optimizerRequest.current) return
      validateOptimizerResult(result)
      setOptimizerResult(result)
      if (result.status !== 'optimal' && result.status !== 'infeasible') setRequestError(result.message ?? `Optimizer finished with status: ${result.status}`)
    } catch (error) {
      if (requestNumber === optimizerRequest.current) { setOptimizerResult(null); setRequestError(error instanceof Error ? error.message : 'Could not reach the schedule optimizer.') }
    } finally { if (requestNumber === optimizerRequest.current) setGenerating(false) }
  }

  const activeCourses = optimizerResult?.status === 'optimal' ? optimizerSectionsToCourses(optimizerResult.selected_sections) : []
  const onlineSections = optimizerResult?.status === 'optimal' ? onlineOptimizerSections(optimizerResult.selected_sections) : []
  const currentCredits = mode === 'manual'
    ? manualCourses.reduce((acc, c) => acc + c.credits, 0)
    : optimizerResult?.total_credits ?? aiCredits

  async function handleSave() {
    if (mode === 'ai') {
      if (optimizerResult?.status !== 'optimal') { setToast('Generate and approve a schedule before saving.'); return }
      const sectionIds = optimizerResult.selected_sections.map((section) => Number(section.id))
      if (sectionIds.some((id) => !Number.isInteger(id))) { setToast('The optimizer returned an invalid section ID.'); return }
      try {
        await api.schedules.create({ name: `Optimized Schedule ${new Date().toLocaleDateString()}`, termId: optimizerForm.termId ?? undefined, sectionIds })
        setToast('Schedule saved successfully!')
      } catch (err) { setToast(err instanceof Error ? err.message : 'Could not save schedule.') }
      return
    }
    const ids = manualCourses.map((c) => c.sectionId).filter((x): x is number => x != null)
    if (ids.length === 0) {
      setToast('Add at least one course before saving.')
      return
    }
    try {
      await api.schedules.create({
        name: `My Schedule ${new Date().toLocaleDateString()}`,
        sectionIds: ids,
      })
      setToast('Schedule saved successfully!')
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not save schedule.')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top controls bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        {/* Mode toggle */}
        <div className="flex rounded-lg p-0.5" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
          {[{ id: 'ai', label: 'AI Builder', icon: <Sparkles size={12} /> }, { id: 'manual', label: 'Manual Builder', icon: <CalendarDays size={12} /> }].map((m) => (
            <button
              key={m.id}
              onClick={() => setPage(m.id === 'ai' ? 'ai-scheduler' : 'manual-builder')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: mode === m.id ? '#FFFFFF' : 'transparent',
                color: mode === m.id ? 'var(--color-primary, #4338CA)' : '#64748B',
                boxShadow: mode === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {m.icon}{m.label}
            </button>
          ))}
        </div>

        {/* Result tabs are frontend-ready; no schedules are fabricated. */}
        {mode === 'ai' && (
          <div className="flex items-center gap-1 rounded-lg p-0.5 ml-1" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
            {[0, 1, 2].map((index) => <button key={index} onClick={() => setActiveSchedule(index)} className="rounded-md px-3 py-1.5" style={{ fontSize: 11, fontWeight: 700, background: activeSchedule === index ? '#FFFFFF' : 'transparent', color: activeSchedule === index ? 'var(--color-primary, #4338CA)' : '#64748B', boxShadow: activeSchedule === index ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>Schedule {index + 1}</button>)}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Credits count (AI Builder only) */}
          {mode === 'ai' && (
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <TrendingUp size={12} color="#16A34A" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>{currentCredits} Credits</span>
            </div>
          )}
          <button
            onClick={() => void handleSave()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
            style={{ fontSize: 12, fontWeight: 600, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
          >
            <Bookmark size={12} />
            Save
          </button>
        </div>
      </div>

      {/* Main content */}
      {mode === 'ai' ? (
        <div className="flex flex-1 overflow-hidden relative">
          {generating && (
            <div className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: 'rgba(248,250,252,0.8)', backdropFilter: 'blur(4px)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl p-4" style={{ background: 'white', boxShadow: '0 8px 32px rgba(67,56,202,0.15)', border: '1px solid #E0E7FF' }}>
                  <Sparkles size={28} color="#4338CA" className="animate-pulse" />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#4338CA' }}>Generating your perfect schedule...</div>
              </div>
            </div>
          )}
          <OptimizerPreferences form={optimizerForm} setForm={(value) => { optimizerRequest.current += 1; setOptimizerResult(null); setOptimizerForm(value) }} terms={terms} attributes={attributes} loading={loadingOptions} optimizing={generating} error={formError} onGenerate={handleGenerate} />
          <div className="flex-1 overflow-hidden flex flex-col">
            {requestError && <div className="m-3 rounded-xl p-3" style={{ background: '#FEF2F2', color: '#B91C1C', fontSize: 12 }}>{requestError}</div>}
            {optimizerResult?.status === 'infeasible' && <div className="m-3 rounded-xl p-4" style={{ background: '#FFF7ED', color: '#9A3412' }}><b>No feasible schedule was found.</b>{optimizerResult.message && <div className="mt-1 text-sm">{optimizerResult.message}</div>}</div>}
            {optimizerResult?.status === 'optimal' && <div className="flex gap-2 px-3 pt-3">{[['Credits', optimizerResult.total_credits], ['Campus days', optimizerResult.campus_days], ['Largest gaps', optimizerResult.weekly_largest_gaps_sum_minutes == null ? undefined : `${optimizerResult.weekly_largest_gaps_sum_minutes} min`], ['Professor penalty', optimizerResult.professor_preference_penalty]].map(([label,value]) => value == null ? null : <div key={String(label)} className="rounded-lg px-3 py-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 11 }}><b>{String(value)}</b> {label}</div>)}</div>}
            {onlineSections.length > 0 && <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}><b style={{ fontSize: 11 }}>Online / Asynchronous</b><div className="flex flex-wrap gap-2 mt-1">{onlineSections.map((section) => <span key={String(section.id)} className="rounded-lg px-2 py-1" style={{ background: '#FFFFFF', fontSize: 10 }}>{section.course_code ?? section.course_id}{section.component_type ? ` — ${section.component_type}` : ''}</span>)}</div></div>}
            <WeeklyCalendar courses={activeCourses} onCourseClick={setSelectedCourse} />
          </div>
          <AIAssistantPanel onGenerate={handleGenerate} />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ManualBuilder courses={manualCourses} setCourses={setManualCourses} />
        </div>
      )}

      {selectedCourse && (
        <CourseModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
