import { useState, useRef, useEffect } from 'react'
import {
  Plus, X, Trash2, Sparkles, RotateCcw, Zap, GitCompare,
  Eye, ArrowLeftRight, Send, Bot, User, Info, AlertCircle,
  BookOpen, Clock, MapPin, Star, TrendingUp, Bookmark,
  GripVertical, Search, CalendarDays, CheckCircle,
} from 'lucide-react'
import type { Page } from '../App'
import { api, type CourseSummary, type CourseSection, type CourseReview, type GradeDistributionRow } from '../lib/api'
import { displayName, timeAgo } from '../lib/format'

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

const SCHEDULE_1: Course[] = [
  {
    id: 'eece330',
    code: 'EECE 330',
    name: 'Digital Systems',
    section: '01',
    professor: 'Dr. Hassan',
    room: 'BE-301',
    days: [0, 2],
    startHour: 10,
    startMin: 0,
    durationMin: 75,
    color: '#4338CA',
    colorLight: '#EEF2FF',
    credits: 3,
    sectionId: null,
  },
  {
    id: 'math201',
    code: 'MATH 201',
    name: 'Calculus III',
    section: '03',
    professor: 'Dr. Khalil',
    room: 'SCC-210',
    days: [1, 3],
    startHour: 9,
    startMin: 0,
    durationMin: 75,
    color: '#059669',
    colorLight: '#ECFDF5',
    credits: 3,
    sectionId: null,
  },
  {
    id: 'phys211',
    code: 'PHYS 211',
    name: 'Physics II',
    section: '02',
    professor: 'Dr. Nassif',
    room: 'SCC-315',
    days: [0, 2, 4],
    startHour: 13,
    startMin: 0,
    durationMin: 60,
    color: '#0284C7',
    colorLight: '#F0F9FF',
    credits: 3,
    sectionId: null,
  },
  {
    id: 'eece351',
    code: 'EECE 351',
    name: 'Signals & Systems',
    section: '01',
    professor: 'Dr. Farhat',
    room: 'BE-402',
    days: [1, 3],
    startHour: 11,
    startMin: 30,
    durationMin: 90,
    color: '#7C3AED',
    colorLight: '#F5F3FF',
    credits: 3,
    sectionId: null,
  },
  {
    id: 'chem201',
    code: 'CHEM 201',
    name: 'General Chemistry',
    section: '05',
    professor: 'Dr. Ibrahim',
    room: 'SCC-110',
    days: [4],
    startHour: 8,
    startMin: 0,
    durationMin: 60,
    color: '#D97706',
    colorLight: '#FFFBEB',
    credits: 3,
    sectionId: null,
  },
]

const SCHEDULE_2: Course[] = [
  { ...SCHEDULE_1[0], days: [1, 3], startHour: 11, section: '02', room: 'BE-205' },
  { ...SCHEDULE_1[1], days: [0, 2], startHour: 14, section: '01', room: 'SCC-108' },
  { ...SCHEDULE_1[2], days: [1, 3], startHour: 15, section: '04', room: 'SCC-220' },
  { ...SCHEDULE_1[3], days: [0, 2], startHour: 9, section: '03', room: 'BE-301' },
  { ...SCHEDULE_1[4], days: [4], startHour: 10, section: '02', room: 'SCC-112' },
]

const SCHEDULES = [SCHEDULE_1, SCHEDULE_2, SCHEDULE_1.slice(0, 4)]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function formatHour(h: number) {
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
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
  return days
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((n) => !Number.isNaN(n))
}

function parseTime(t: string | null): { hours: number; minutes: number } | null {
  if (!t) {
    return null
  }
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) {
    return null
  }
  return { hours: h, minutes: m ?? 0 }
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
  return e.hours * 60 + e.minutes - (s.hours * 60 + s.minutes)
}

// ----- Course Detail Modal -----
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
  onPick: (sec: CourseSection) => void
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 480, maxHeight: '85vh', background: '#FFFFFF' }}>
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
          {!loading && sections.length === 0 && !error && (
            <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>No sections available this semester.</div>
          )}
          {sections.map((sec) => {
            const isCurrent = sec.section_number === currentSection
            const start = parseTime(sec.start_time)
            const end = parseTime(sec.end_time)
            const startLabel = start ? `${timeLabel(sec.start_time)}` : '—'
            const endLabel = end ? timeLabel(sec.end_time) : '—'
            const seatsLeft = sec.seats_total !== null && sec.seats_remaining !== null ? sec.seats_remaining : null
            return (
              <button
                key={sec.id}
                onClick={() => onPick(sec)}
                className="flex items-start gap-4 p-4 rounded-xl text-left transition-all"
                style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', cursor: isCurrent ? 'default' : 'pointer', opacity: isCurrent ? 0.75 : 1 }}
                onMouseEnter={(e) => { if (!isCurrent) { e.currentTarget.style.border = '1px solid #4338CA50'; e.currentTarget.style.background = '#EEF2FF' } }}
                onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid #F1F5F9'; e.currentTarget.style.background = '#F8FAFC' }}
              >
                <div className="rounded-lg px-2 py-1 shrink-0" style={{ background: '#4338CA20', color: '#4338CA', fontSize: 12, fontWeight: 800 }}>
                  §{sec.section_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{displayName(sec.professors?.first_name, sec.professors?.last_name) || 'Unknown instructor'}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{daysLabel(parseDays(sec.days))} · {startLabel} – {endLabel} · {sec.room || 'TBA'}</div>
                  <div style={{ fontSize: 11, color: seatsLeft !== null && seatsLeft > 0 ? '#059669' : '#94A3B8', marginTop: 2 }}>
                    {seatsLeft !== null ? `${seatsLeft} seats open` : 'Seats N/A'}
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
              {height > 40 && (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, marginTop: 1 }}>
                  {course.name}
                </div>
              )}
              {height > 55 && (
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 'auto' }}>
                  {course.room}
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
function PreferencesPanel({ onGenerate }: { onGenerate: () => void }) {
  const [requiredCourses, setRequiredCourses] = useState(['EECE 330', 'MATH 201', 'PHYS 211', 'EECE 351'])
  const [newCourse, setNewCourse] = useState('')
  const [priority, setPriority] = useState('Balanced workload')
  const [startTime, setStartTime] = useState('9:00 AM')
  const [endTime, setEndTime] = useState('6:00 PM')
  const [maxClasses, setMaxClasses] = useState('3')
  const [freeDays, setFreeDays] = useState<string[]>(['Friday'])
  const [minBreak, setMinBreak] = useState('30 min')

  const toggleDay = (d: string) => {
    setFreeDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  return (
    <div
      className="h-full overflow-y-auto flex flex-col gap-3 p-4"
      style={{ width: 264, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Student Preferences</div>

      {/* Required courses */}
      <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Required Courses
        </div>
        <div className="flex flex-col gap-1.5 mb-2">
          {requiredCourses.map((c) => (
            <div key={c} className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
              style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4338CA' }}>{c}</span>
              <button onClick={() => setRequiredCourses((p) => p.filter((x) => x !== c))}
                style={{ color: '#818CF8' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newCourse}
            onChange={(e) => setNewCourse(e.target.value)}
            placeholder="Add course..."
            className="flex-1 rounded-lg px-2.5 py-1.5 outline-none"
            style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCourse.trim()) {
                setRequiredCourses((p) => [...p, newCourse.trim()])
                setNewCourse('')
              }
            }}
          />
          <button
            onClick={() => { if (newCourse.trim()) { setRequiredCourses((p) => [...p, newCourse.trim()]); setNewCourse('') } }}
            className="rounded-lg px-2 py-1.5"
            style={{ background: '#4338CA', color: 'white' }}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Time prefs */}
      <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Class Times
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Earliest Start', val: startTime, set: setStartTime, options: ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM'] },
            { label: 'Latest End', val: endTime, set: setEndTime, options: ['3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'] },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
              <select
                value={f.val}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-lg px-2 py-1.5 outline-none"
                style={{ fontSize: 11, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#374151' }}
              >
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule options */}
      <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preferences
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>Max Classes/Day</div>
            <select value={maxClasses} onChange={(e) => setMaxClasses(e.target.value)}
              className="w-full rounded-lg px-2 py-1.5 outline-none"
              style={{ fontSize: 11, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#374151' }}>
              {['1', '2', '3', '4', '5'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>Min Break Between Classes</div>
            <select value={minBreak} onChange={(e) => setMinBreak(e.target.value)}
              className="w-full rounded-lg px-2 py-1.5 outline-none"
              style={{ fontSize: 11, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#374151' }}>
              {['No minimum', '15 min', '30 min', '45 min', '1 hour'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 3 }}>Schedule Priority</div>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg px-2 py-1.5 outline-none"
              style={{ fontSize: 11, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#374151' }}>
              {['Shortest days', 'Longest weekends', 'Balanced workload', 'Highest rated professors', 'Lowest workload', 'No morning classes'].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Free days */}
      <div className="rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Preferred Free Days
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => {
            const sel = freeDays.includes(d)
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold transition-all"
                style={{
                  background: sel ? '#4338CA' : '#F1F5F9',
                  color: sel ? 'white' : '#64748B',
                  border: sel ? '1px solid #4338CA' : '1px solid #E2E8F0',
                }}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>

      {/* Buttons */}
      <button
        onClick={onGenerate}
        className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
        style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', color: 'white', fontSize: 13 }}
      >
        <Sparkles size={14} />
        Generate Schedule
      </button>
      <button
        className="w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
        style={{ background: '#F1F5F9', color: '#64748B', fontSize: 13 }}
      >
        <RotateCcw size={13} />
        Reset Preferences
      </button>
    </div>
  )
}

// ----- AI Assistant Panel -----
interface Message {
  role: 'user' | 'ai'
  text: string
  timestamp: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'ai',
    text: "Hi Alex! I've analyzed your preferences and generated 3 schedule options. Schedule 1 gives you the best work-life balance with Fridays partially free. What would you like to adjust?",
    timestamp: '10:02 AM',
  },
  {
    role: 'user',
    text: 'I want no classes before 10 AM and I only want professors rated above 4.5.',
    timestamp: '10:04 AM',
  },
  {
    role: 'ai',
    text: "Got it! I've updated Schedule 1 to start no earlier than 10 AM. Dr. Hassan (4.8★), Dr. Khalil (4.6★), and Dr. Nassif (4.9★) all qualify. CHEM 201 on Friday is the only exception — Dr. Ibrahim is rated 4.3★. Want me to find an alternative section?",
    timestamp: '10:04 AM',
  },
]

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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg: Message = { role: 'user', text: input, timestamp: 'now' }
    setMessages((p) => [...p, userMsg])
    setInput('')
    setLoading(true)
    // TODO(frontend): no AI conversation endpoint yet — response is a UI placeholder.
    setTimeout(() => {
      setMessages((p) => [...p, {
        role: 'ai',
        text: "I've updated the schedule based on your preferences. Schedule 2 now satisfies most constraints. Would you like me to optimize further or compare the options?",
        timestamp: 'now',
      }])
      setLoading(false)
      onGenerate()
    }, 1200)
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ width: 300, background: '#FFFFFF', borderLeft: '1px solid #F1F5F9' }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="rounded-lg p-1.5" style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)' }}>
          <Sparkles size={13} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>AI Assistant</div>
          <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>● Online</div>
        </div>
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

      {/* Reasoning card */}
      <div className="mx-3 mb-2 rounded-xl p-3" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Info size={12} color="#0284C7" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0284C7' }}>Reasoning</span>
        </div>
        <p style={{ fontSize: 11, color: '#0369A1', lineHeight: 1.6 }}>
          I selected this schedule because it minimizes walking distance between buildings while keeping all your classes after 10 AM.
        </p>
      </div>

      {/* Trade-offs card */}
      <div className="mx-3 mb-2 rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle size={12} color="#D97706" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>Trade-offs</span>
        </div>
        <div className="flex flex-col gap-1">
          {[
            { ok: true, text: 'Fridays free' },
            { ok: true, text: 'Highest rated professors' },
            { ok: true, text: 'No classes before 10' },
            { ok: false, text: 'EECE 351 morning section mandatory' },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span style={{ fontSize: 13, lineHeight: 1 }}>{t.ok ? '✓' : '✗'}</span>
              <span style={{ fontSize: 11, color: t.ok ? '#059669' : '#DC2626', fontWeight: t.ok ? 500 : 600 }}>{t.text}</span>
            </div>
          ))}
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
          { icon: <GitCompare size={11} />, label: 'Compare', fn: () => {} },
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

  const buildCourse = (src: { code: string; title: string; credits: number }, sec: CourseSection): Course => {
    const color = COURSE_COLORS[courses.length % COURSE_COLORS.length]
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
      startHour: start?.hours ?? 8,
      startMin: start?.minutes ?? 0,
      durationMin: start && end ? durationMinutes(sec.start_time, sec.end_time) : 60,
      color,
      colorLight: color + '15',
      credits: src.credits,
      sectionId: sec.id,
    }
  }

  const handlePick = (sec: CourseSection) => {
    if (!picking) {
      return
    }
    setCourses((p) => [...p, buildCourse(picking, sec)])
    setPicking(null)
  }

  const handleSwap = (target: Course, sec: CourseSection) => {
    const start = parseTime(sec.start_time)
    const end = parseTime(sec.end_time)
    setCourses((p) =>
      p.map((c) => c.id === target.id ? {
        ...c,
        section: sec.section_number,
        professor: displayName(sec.professors?.first_name, sec.professors?.last_name),
        room: sec.room ?? '',
        days: parseDays(sec.days),
        startHour: start?.hours ?? c.startHour,
        startMin: start?.minutes ?? c.startMin,
        durationMin: start && end ? durationMinutes(sec.start_time, sec.end_time) : c.durationMin,
        sectionId: sec.id,
      } : c)
    )
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
              placeholder="Search courses..."
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
          {/* TODO(frontend): automatic conflict fixing not wired — no backend endpoint for unsaved builders. */}
          <button
            onClick={() => setNotice('Automatic conflict fixing isn\'t wired yet. Review your calendar or adjust sections manually.')}
            className="w-full py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', color: 'white', fontSize: 13 }}
          >
            <Sparkles size={14} />
            AI Fix Conflicts
          </button>
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
  setTimeout(onDone, 3000)
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
      style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600, animation: 'none' }}>
      <CheckCircle size={16} color="#10B981" />
      {message}
    </div>
  )
}

export default function AIScheduler({ activeMode }: { activeMode: Page; setPage: (p: Page) => void }) {
  const [mode, setMode] = useState<'ai' | 'manual'>(activeMode === 'manual-builder' ? 'manual' : 'ai')
  const [scheduleTab, setScheduleTab] = useState(0)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [generating, setGenerating] = useState(false)
  const [_currentScheduleIdx, setCurrentScheduleIdx] = useState(0)
  const [manualCourses, setManualCourses] = useState<Course[]>([])
  const [toast, setToast] = useState<string | null>(null)

  // TODO(frontend): no schedule-generation endpoint yet (Phase 9 unchecked) — AI preview stays a UI placeholder.
  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      setCurrentScheduleIdx((p) => (p + 1) % SCHEDULES.length)
      setGenerating(false)
    }, 1500)
  }

  const activeCourses = SCHEDULES[scheduleTab] ?? SCHEDULE_1
  const currentCredits = mode === 'manual'
    ? manualCourses.reduce((acc, c) => acc + c.credits, 0)
    : activeCourses.reduce((acc, c) => acc + c.credits, 0)

  async function handleSave() {
    if (mode === 'ai') {
      setToast('AI-generated previews aren\'t saved yet — build a schedule in Manual Builder to save.')
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
              onClick={() => setMode(m.id as 'ai' | 'manual')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: mode === m.id ? '#FFFFFF' : 'transparent',
                color: mode === m.id ? '#4338CA' : '#64748B',
                boxShadow: mode === m.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {m.icon}{m.label}
            </button>
          ))}
        </div>

        {/* Schedule tabs (AI mode only) */}
        {mode === 'ai' && (
          <div className="flex items-center gap-1">
            {['Schedule 1', 'Schedule 2', 'Schedule 3'].map((t, i) => (
              <button
                key={t}
                onClick={() => setScheduleTab(i)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: scheduleTab === i ? '#EEF2FF' : 'transparent',
                  color: scheduleTab === i ? '#4338CA' : '#64748B',
                  border: scheduleTab === i ? '1px solid #C7D2FE' : '1px solid transparent',
                }}
              >
                {t}
                {scheduleTab === i && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4338CA' }} />}
              </button>
            ))}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
              style={{ fontSize: 12, fontWeight: 600, color: '#64748B', border: '1px solid #E2E8F0' }}
            >
              <GitCompare size={12} />
              Compare
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Credits count */}
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <TrendingUp size={12} color="#16A34A" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>{currentCredits} Credits</span>
          </div>
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
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Analyzing 847 section combinations</div>
              </div>
            </div>
          )}
          <PreferencesPanel onGenerate={handleGenerate} />
          <div className="flex-1 overflow-hidden">
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
