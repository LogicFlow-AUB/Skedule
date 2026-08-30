import { useEffect, useState } from 'react'
import { BookmarkCheck, GitCompare, Eye, FileDown, X, Calendar, Clock, BookOpen, CheckCircle, Star, Pencil, Sparkles } from 'lucide-react'
import type { Page } from '../App'
import { api, type ScheduleSummary, type ScheduleDetail } from '../lib/api'
import { displayName, formatDate } from '../lib/format'

const HOUR_HEIGHT = 60
const START_HOUR = 7
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const COURSE_COLORS = ['#4338CA', '#059669', '#0284C7', '#7C3AED', '#D97706', '#10B981', '#F59E0B', '#DC2626']

interface Course {
  id: string
  code: string
  name: string
  section: string
  professor: string
  room: string
  days: number[]
  startHour: number
  startMin: number
  durationMin: number
  color: string
}

function toCourses(detail?: ScheduleDetail): Course[] {
  if (!detail) {
    return []
  }
  return detail.courses.map((c, i) => {
    const sec = c.section
    return {
      id: `${c.courseId ?? 'c'}-${sec.id}`,
      code: c.code ?? '—',
      name: c.title ?? '',
      section: sec.sectionNumber,
      professor: displayName(c.professor?.firstName, c.professor?.lastName),
      room: sec.room ?? '',
      days: sec.days,
      startHour: Math.floor((sec.startMinutes ?? 0) / 60),
      startMin: (sec.startMinutes ?? 0) % 60,
      durationMin: sec.durationMinutes ?? 60,
      color: COURSE_COLORS[i % COURSE_COLORS.length],
    }
  })
}

function formatDays(days: number[]): string {
  if (days.length === 0) {
    return '—'
  }
  return days.map((d) => DAYS[d] ?? `Day ${d}`).join(' · ')
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + START_HOUR)

function formatHour(h: number) {
  if (h === 12) return '12 PM'
  if (h > 12) return `${h - 12} PM`
  return `${h} AM`
}

// Mini calendar preview
function MiniCalendar({ courses }: { courses: Course[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
      <div className="flex" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ width: 36, flexShrink: 0 }} />
        {DAYS.map((d) => (
          <div key={d} className="flex-1 text-center py-1.5" style={{ fontSize: 10, fontWeight: 700, color: '#64748B', background: '#F8FAFC' }}>{d}</div>
        ))}
      </div>
      <div className="flex" style={{ height: 8 * HOUR_HEIGHT / 2 }}>
        <div style={{ width: 36, flexShrink: 0 }}>
          {HOURS.slice(0, 8).map((h) => (
            <div key={h} className="flex items-start justify-end pr-1" style={{ height: HOUR_HEIGHT / 2, paddingTop: 1 }}>
              <span style={{ fontSize: 8, color: '#CBD5E1', fontWeight: 500 }}>{formatHour(h)}</span>
            </div>
          ))}
        </div>
        {DAYS.map((_, di) => {
          const dayCourses = courses.filter((c) => c.days.includes(di))
          return (
            <div key={di} className="flex-1 relative" style={{ borderLeft: '1px solid #F8FAFC' }}>
              {HOURS.slice(0, 8).map((h) => (
                <div key={h} style={{ height: HOUR_HEIGHT / 2, borderTop: '1px solid #F8FAFC' }} />
              ))}
              {dayCourses.map((c) => {
                const top = (c.startHour - START_HOUR + c.startMin / 60) * (HOUR_HEIGHT / 2)
                const height = (c.durationMin / 60) * (HOUR_HEIGHT / 2)
                return (
                  <div key={c.id} className="absolute left-0.5 right-0.5 rounded"
                    style={{ top, height, background: c.color, opacity: 0.85 }}>
                    <div style={{ fontSize: 7, fontWeight: 800, color: 'white', padding: '1px 2px', lineHeight: 1.3 }}>{c.code.split(' ')[1]}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Full calendar modal
function ScheduleViewModal({ detail, onClose }: { detail: ScheduleDetail; onClose: () => void }) {
  const courses = toCourses(detail)
  const totalHours = 14

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 800, maxWidth: 'calc(100vw - 32px)', maxHeight: '88vh', background: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{detail.name ?? `Schedule #${detail.id}`}</h2>
            <p style={{ fontSize: 12, color: '#64748B' }}>{detail.totalCredits} credits · {formatDays(detail.days)} · {detail.courseCount} courses</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <div className="flex sticky top-0 z-10" style={{ background: '#FFFFFF', borderBottom: '2px solid #F1F5F9' }}>
            <div style={{ width: 52, flexShrink: 0 }} />
            {DAYS.map((d) => (
              <div key={d} className="flex-1 text-center py-2.5" style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>{d}</div>
            ))}
          </div>
          <div className="flex">
            <div style={{ width: 52, flexShrink: 0 }}>
              {HOURS.map((h) => (
                <div key={h} className="flex items-start justify-end pr-2" style={{ height: HOUR_HEIGHT, paddingTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>{formatHour(h)}</span>
                </div>
              ))}
            </div>
            {DAYS.map((_, di) => {
              const dayCourses = courses.filter((c) => c.days.includes(di))
              return (
                <div key={di} className="flex-1 relative" style={{ height: totalHours * HOUR_HEIGHT }}>
                  {HOURS.map((h) => (
                    <div key={h} className="absolute left-0 right-0" style={{ top: (h - START_HOUR) * HOUR_HEIGHT, borderTop: '1px solid #F1F5F9' }} />
                  ))}
                  {dayCourses.map((c) => {
                    const top = (c.startHour - START_HOUR + c.startMin / 60) * HOUR_HEIGHT
                    const height = (c.durationMin / 60) * HOUR_HEIGHT
                    return (
                      <div key={c.id} className="absolute left-1 right-1 rounded-lg p-1.5"
                        style={{ top, height, background: c.color, opacity: 0.9 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'white' }}>{c.code}</div>
                        {height > 40 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>{c.professor}</div>}
                        {height > 55 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>{c.room}</div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 px-6 py-3 flex-wrap" style={{ borderTop: '1px solid #F1F5F9' }}>
          {courses.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <div className="rounded-full" style={{ width: 8, height: 8, background: c.color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{c.code}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// Compare modal
function CompareModal({ summaries, details, onClose }: { summaries: ScheduleSummary[]; details: Record<number, ScheduleDetail>; onClose: () => void }) {
  const [leftId, setLeftId] = useState(summaries[0]?.id ?? 0)
  const [rightId, setRightId] = useState(summaries[1]?.id ?? summaries[0]?.id ?? 0)

  const leftSummary = summaries.find((s) => s.id === leftId) ?? summaries[0]
  const rightSummary = summaries.find((s) => s.id === rightId) ?? summaries[1]
  if (!leftSummary || !rightSummary) {
    return null
  }

  const leftCourses = toCourses(details[leftSummary.id])
  const rightCourses = toCourses(details[rightSummary.id])

  const leftCodes = new Set(leftCourses.map((c) => c.code))
  const rightCodes = new Set(rightCourses.map((c) => c.code))
  const shared = leftCourses.filter((c) => rightCodes.has(c.code))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 920, maxWidth: 'calc(100vw - 32px)', maxHeight: '88vh', background: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Compare Schedules</div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* Selectors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {[
              { id: leftId, set: setLeftId },
              { id: rightId, set: setRightId },
            ].map((s, i) => (
              <div key={i}>
                <select value={s.id} onChange={(e) => s.set(Number(e.target.value))}
                  className="w-full rounded-xl px-3 py-2 outline-none font-semibold"
                  style={{ fontSize: 13, border: '1px solid #E2E8F0', color: '#1E293B', background: '#F8FAFC' }}>
                  {summaries.map((sc) => <option key={sc.id} value={sc.id}>{sc.name ?? `Schedule #${sc.id}`}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {[
              { sched: leftSummary, courses: leftCourses, otherCodes: rightCodes },
              { sched: rightSummary, courses: rightCourses, otherCodes: leftCodes },
            ].map(({ sched, courses, otherCodes }) => (
              <div key={sched.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
                <div className="px-4 py-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{sched.name ?? `Schedule #${sched.id}`}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{sched.totalCredits} credits · {sched.courseCount} courses</div>
                </div>
                <MiniCalendar courses={courses} />
                <div className="p-4 flex flex-col gap-2">
                  {courses.map((c) => {
                    const inOther = otherCodes.has(c.code)
                    return (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: inOther ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${inOther ? '#BBF7D0' : '#F1F5F9'}` }}>
                        <div className="rounded-full shrink-0" style={{ width: 8, height: 8, background: c.color }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.code}</span>
                        <span style={{ fontSize: 11, color: '#64748B', flex: 1 }}>{c.professor}</span>
                        {inOther && <CheckCircle size={12} color="#10B981" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Shared courses highlight */}
          {shared.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>
                ✓ {shared.length} shared course{shared.length > 1 ? 's' : ''} across both schedules
              </div>
              <div className="flex gap-2 flex-wrap">
                {shared.map((c) => (
                  <span key={c.id} className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 11, fontWeight: 700, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>
                    {c.code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Toast
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500)
    return () => clearTimeout(timer)
  }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
      style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600, animation: 'none' }}>
      <CheckCircle size={16} color="#10B981" />
      {message}
    </div>
  )
}

export default function SavedSchedules({ setPage }: { setPage?: (p: Page) => void }) {
  const [viewDetail, setViewDetail] = useState<ScheduleDetail | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<ScheduleSummary[]>([])
  const [details, setDetails] = useState<Record<number, ScheduleDetail>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function handleSetFavorite(id: number) {
    try {
      await api.schedules.favorite(id)
      // The list reload reflects the single per-user favorite.
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update preferred schedule.')
    }
  }

  async function handleLoad(id: number, mode: Page) {
    try {
      const res = await api.schedules.loadAsDraft(id)
      // Remember which term the loaded draft belongs to so the builders open on
      // it instead of defaulting to the first term (which would leave the
      // calendar empty for drafts that live in a different / no term).
      const term = res.data.termId
      sessionStorage.setItem('logicflow.openTerm', term == null ? '' : String(term))
      if (setPage) {
        setPage(mode)
        setToast('Loaded into the builder.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load schedule.')
    }
  }

  const reload = async () => {
    const { data } = await api.schedules.list(1, 50)
    setSummaries(data)
    const loaded = await Promise.all(data.map((s) => api.schedules.get(s.id)))
    const map: Record<number, ScheduleDetail> = {}
    for (const res of loaded) {
      map[res.data.id] = res.data
    }
    setDetails(map)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data } = await api.schedules.list(1, 50)
        if (cancelled) {
          return
        }
        setSummaries(data)
        const loaded = await Promise.all(data.map((s) => api.schedules.get(s.id)))
        if (!cancelled) {
          const map: Record<number, ScheduleDetail> = {}
          for (const res of loaded) {
            map[res.data.id] = res.data
          }
          setDetails(map)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load schedules.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleDelete(id: number) {
    try {
      await api.schedules.remove(id)
      setSummaries((prev) => prev.filter((s) => s.id !== id))
      setDetails((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete schedule.')
    }
  }

  const handlePDF = async (id: number, name: string) => {
    setToast(`Downloading "${name}" as PDF...`)
    try {
      const blob = await api.schedules.pdf(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${name}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setToast(`Downloaded "${name}.pdf"`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the PDF.')
      setToast(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Saved Schedules</h1>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{loading ? 'Loading...' : `${summaries.length} schedules saved`}</p>
          </div>
          <button
            onClick={() => setShowCompare(true)}
            disabled={summaries.length < 2}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all"
            style={{ fontSize: 13, background: summaries.length >= 2 ? 'var(--color-primary, #4338CA)' : '#E2E8F0', color: summaries.length >= 2 ? 'white' : '#94A3B8', cursor: summaries.length >= 2 ? 'pointer' : 'not-allowed' }}
            onMouseEnter={(e) => { if (summaries.length >= 2) e.currentTarget.style.background = 'var(--color-primary-dark, #3730A3)' }}
            onMouseLeave={(e) => { if (summaries.length >= 2) e.currentTarget.style.background = 'var(--color-primary, #4338CA)' }}
          >
            <GitCompare size={15} />
            Compare All
          </button>
        </div>
      </div>

      {/* Schedule cards */}
      <div className="px-8 py-6 flex flex-col gap-5">
        {error && (
          <div className="rounded-xl px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
            {error}
          </div>
        )}

        {summaries.map((s) => {
          const courses = toCourses(details[s.id])
          return (
            <div key={s.id} className="rounded-2xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <div className="flex flex-col xl:flex-row gap-6 p-5">
                {/* Mini calendar preview */}
                <div style={{ width: '100%', maxWidth: 340, flexShrink: 0 }}>
                  {courses.length > 0 ? <MiniCalendar courses={courses} /> : (
                    <div className="flex items-center justify-center rounded-xl" style={{ height: 160, background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading preview...</div>
                    </div>
                  )}
                </div>

                {/* Info + actions */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{s.name ?? `Schedule #${s.id}`}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                          <BookOpen size={12} />{s.totalCredits} credits
                        </span>
                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                          <Calendar size={12} />{formatDays(s.days)}
                        </span>
                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                          <Clock size={12} />Saved {formatDate(s.createdAt)}
                        </span>
                      </div>
                      {s.notes && <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.5 }}>{s.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {s.isFavorite ? (
                        <button
                          title="Preferred schedule"
                          className="rounded-lg p-1.5"
                          style={{ color: '#F59E0B', cursor: 'default' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFBEB' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <Star size={15} fill="#F59E0B" />
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleSetFavorite(s.id)}
                          title={summaries.length > 1 ? 'Make preferred' : 'Preferred schedule'}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: summaries.length > 1 ? '#CBD5E1' : '#F59E0B' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFBEB' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <Star size={15} fill={summaries.length > 1 ? 'none' : '#F59E0B'} />
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(s.id)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ color: '#CBD5E1' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1' }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Course tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {courses.map((c) => (
                      <span key={c.id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                        style={{ fontSize: 11, fontWeight: 700, background: c.color + '15', color: c.color, border: `1px solid ${c.color}30` }}>
                        <div className="rounded-full" style={{ width: 6, height: 6, background: c.color }} />
                        {c.code}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    <button
                      onClick={() => { const d = details[s.id]; if (d) setViewDetail(d) }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: 'var(--color-primary-light, #EEF2FF)', color: 'var(--color-primary, #4338CA)', border: '1px solid var(--color-primary-border, #C7D2FE)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-border, #E0E7FF)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary-light, #EEF2FF)' }}
                    >
                      <Eye size={13} />
                      View Schedule
                    </button>
                    <button
                      onClick={() => setShowCompare(true)}
                      disabled={summaries.length < 2}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: '#F8FAFC', color: summaries.length >= 2 ? '#64748B' : '#CBD5E1', border: '1px solid #E2E8F0' }}
                      onMouseEnter={(e) => { if (summaries.length >= 2) { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374151' } }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; if (summaries.length >= 2) e.currentTarget.style.color = '#64748B' }}
                    >
                      <GitCompare size={13} />
                      Compare
                    </button>
                    <button
                      onClick={() => void handlePDF(s.id, s.name ?? `Schedule #${s.id}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374151' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}
                    >
                      <FileDown size={13} />
                      Save as PDF
                    </button>
                    <button
                      onClick={() => void handleLoad(s.id, 'manual-builder')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: '#F8FAFC', color: '#0F172A', border: '1px solid #E2E8F0' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#0F172A' }}
                    >
                      <Pencil size={13} />
                      Open in Manual Builder
                    </button>
                    <button
                      onClick={() => void handleLoad(s.id, 'ai-scheduler')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: '#F8FAFC', color: '#0F172A', border: '1px solid #E2E8F0' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#0F172A' }}
                    >
                      <Sparkles size={13} />
                      Open in Optimized Builder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {!loading && summaries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <BookmarkCheck size={48} color="#CBD5E1" />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#94A3B8', marginTop: 12 }}>No saved schedules</div>
            <p style={{ fontSize: 13, color: '#CBD5E1', marginTop: 4 }}>Generate and save schedules from the Optimized Builder</p>
          </div>
        )}
      </div>

      {viewDetail && <ScheduleViewModal detail={viewDetail} onClose={() => setViewDetail(null)} />}
      {showCompare && <CompareModal summaries={summaries} details={details} onClose={() => setShowCompare(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
