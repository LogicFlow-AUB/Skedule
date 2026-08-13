import { useState } from 'react'
import { BookmarkCheck, GitCompare, Eye, FileDown, X, Calendar, Clock, BookOpen, CheckCircle } from 'lucide-react'

const HOUR_HEIGHT = 60
const START_HOUR = 7
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

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

const SCHEDULE_COURSES: Record<string, Course[]> = {
  'Schedule A': [
    { id: 'e330', code: 'EECE 330', name: 'Digital Systems', section: '01', professor: 'Dr. Hassan', room: 'BE-301', days: [0, 2], startHour: 10, startMin: 0, durationMin: 75, color: 'var(--color-primary)' },
    { id: 'm201', code: 'MATH 201', name: 'Calculus III', section: '03', professor: 'Dr. Khalil', room: 'SCC-210', days: [1, 3], startHour: 9, startMin: 0, durationMin: 75, color: '#059669' },
    { id: 'p211', code: 'PHYS 211', name: 'Physics II', section: '02', professor: 'Dr. Nassif', room: 'SCC-315', days: [0, 2, 4], startHour: 13, startMin: 0, durationMin: 60, color: '#0284C7' },
    { id: 'e351', code: 'EECE 351', name: 'Signals & Systems', section: '01', professor: 'Dr. Farhat', room: 'BE-402', days: [1, 3], startHour: 11, startMin: 30, durationMin: 90, color: '#7C3AED' },
    { id: 'c201', code: 'CHEM 201', name: 'General Chemistry', section: '05', professor: 'Dr. Ibrahim', room: 'SCC-110', days: [4], startHour: 8, startMin: 0, durationMin: 60, color: '#D97706' },
  ],
  'Schedule B': [
    { id: 'e330b', code: 'EECE 330', name: 'Digital Systems', section: '02', professor: 'Dr. Hassan', room: 'BE-205', days: [1, 3], startHour: 11, startMin: 0, durationMin: 75, color: 'var(--color-primary)' },
    { id: 'm201b', code: 'MATH 201', name: 'Calculus III', section: '01', professor: 'Dr. Khalil', room: 'SCC-108', days: [0, 2], startHour: 14, startMin: 0, durationMin: 75, color: '#059669' },
    { id: 'p211b', code: 'PHYS 211', name: 'Physics II', section: '04', professor: 'Dr. Nassif', room: 'SCC-220', days: [1, 3], startHour: 15, startMin: 0, durationMin: 60, color: '#0284C7' },
    { id: 'e351b', code: 'EECE 351', name: 'Signals & Systems', section: '03', professor: 'Dr. Farhat', room: 'BE-301', days: [0, 2], startHour: 9, startMin: 0, durationMin: 90, color: '#7C3AED' },
  ],
  'Schedule C': [
    { id: 'm201c', code: 'MATH 201', name: 'Calculus III', section: '02', professor: 'Dr. Khalil', room: 'SCC-108', days: [1, 3], startHour: 10, startMin: 0, durationMin: 75, color: '#059669' },
    { id: 'p211c', code: 'PHYS 211', name: 'Physics II', section: '01', professor: 'Dr. Nassif', room: 'SCC-315', days: [0, 2], startHour: 11, startMin: 0, durationMin: 60, color: '#0284C7' },
    { id: 'eng', code: 'ENGL 210', name: 'Technical Writing', section: '02', professor: 'Dr. Saad', room: 'FAS-101', days: [1, 3], startHour: 14, startMin: 0, durationMin: 75, color: '#10B981' },
    { id: 'hist', code: 'HIST 101', name: 'World Civilizations', section: '01', professor: 'Dr. Moussa', room: 'FAS-205', days: [4], startHour: 9, startMin: 0, durationMin: 90, color: '#F59E0B' },
  ],
}

const SAVED_SCHEDULES = [
  { key: 'Schedule A', name: 'Schedule A — Preferred', credits: 15, days: 'Mon–Fri', saved: 'Oct 15', notes: 'Best balance of professors and timing. Highest-rated faculty.' },
  { key: 'Schedule B', name: 'Schedule B — Friday Free', credits: 15, days: 'Mon–Thu', saved: 'Oct 12', notes: 'Keeps Friday free. Slightly less preferred sections.' },
  { key: 'Schedule C', name: 'Schedule C — Light Load', credits: 12, days: 'Mon–Thu (light)', saved: 'Oct 8', notes: 'Lighter workload. Missing CHEM 201 and EECE courses.' },
]

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
function ScheduleViewModal({ schedule: s, onClose }: { schedule: typeof SAVED_SCHEDULES[0]; onClose: () => void }) {
  const courses = SCHEDULE_COURSES[s.key] ?? []
  const totalHours = 14

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 800, maxHeight: '88vh', background: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{s.name}</h2>
            <p style={{ fontSize: 12, color: '#64748B' }}>{s.credits} credits · {s.days} · Saved {s.saved}</p>
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
        <div className="flex items-center gap-2 px-6 py-3" style={{ borderTop: '1px solid #F1F5F9' }}>
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
function CompareModal({ schedules, onClose }: { schedules: typeof SAVED_SCHEDULES; onClose: () => void }) {
  const [leftKey, setLeftKey] = useState(schedules[0].key)
  const [rightKey, setRightKey] = useState(schedules[1].key)

  const leftSchedule = schedules.find((s) => s.key === leftKey)!
  const rightSchedule = schedules.find((s) => s.key === rightKey)!
  const leftCourses = SCHEDULE_COURSES[leftKey] ?? []
  const rightCourses = SCHEDULE_COURSES[rightKey] ?? []

  const leftCodes = new Set(leftCourses.map((c) => c.code))
  const rightCodes = new Set(rightCourses.map((c) => c.code))
  const shared = leftCourses.filter((c) => rightCodes.has(c.code))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: 920, maxHeight: '88vh', background: '#FFFFFF' }}>
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
          <div className="grid grid-cols-2 gap-6 mb-6">
            {[{ key: leftKey, set: setLeftKey }, { key: rightKey, set: setRightKey }].map((s, i) => (
              <div key={i}>
                <select value={s.key} onChange={(e) => s.set(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 outline-none font-semibold"
                  style={{ fontSize: 13, border: '1px solid #E2E8F0', color: '#1E293B', background: '#F8FAFC' }}>
                  {schedules.map((sc) => <option key={sc.key} value={sc.key}>{sc.name}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {[
              { sched: leftSchedule, courses: leftCourses, otherCodes: rightCodes },
              { sched: rightSchedule, courses: rightCourses, otherCodes: leftCodes },
            ].map(({ sched, courses, otherCodes }) => (
              <div key={sched.key} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
                <div className="px-4 py-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{sched.name}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{sched.credits} credits · {sched.days}</div>
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
  setTimeout(onDone, 2500)
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
      style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600, animation: 'none' }}>
      <CheckCircle size={16} color="#10B981" />
      {message}
    </div>
  )
}

export default function SavedSchedules() {
  const [viewSchedule, setViewSchedule] = useState<typeof SAVED_SCHEDULES[0] | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [schedules, setSchedules] = useState(SAVED_SCHEDULES)

  const handlePDF = (s: typeof SAVED_SCHEDULES[0]) => {
    setToast(`Downloading "${s.name}" as PDF...`)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div className="px-8 py-6" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Saved Schedules</h1>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{schedules.length} schedules saved for Fall 2025</p>
          </div>
          <button
            onClick={() => setShowCompare(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all"
            style={{ fontSize: 13, background: 'var(--color-primary)', color: 'white' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-primary-dark)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary)' }}
          >
            <GitCompare size={15} />
            Compare All
          </button>
        </div>
      </div>

      {/* Schedule cards */}
      <div className="px-8 py-6 flex flex-col gap-5">
        {schedules.map((s) => {
          const courses = SCHEDULE_COURSES[s.key] ?? []
          return (
            <div key={s.key} className="rounded-2xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <div className="flex gap-6 p-5">
                {/* Mini calendar preview */}
                <div style={{ width: 340, flexShrink: 0 }}>
                  <MiniCalendar courses={courses} />
                </div>

                {/* Info + actions */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{s.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                          <BookOpen size={12} />{s.credits} credits
                        </span>
                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                          <Calendar size={12} />{s.days}
                        </span>
                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                          <Clock size={12} />Saved {s.saved}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.5 }}>{s.notes}</p>
                    </div>
                    <button
                      onClick={() => setSchedules((p) => p.filter((x) => x.key !== s.key))}
                      className="rounded-lg p-1.5 transition-colors"
                      style={{ color: '#CBD5E1' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1' }}
                    >
                      <X size={15} />
                    </button>
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

                  {/* Action buttons — NO Register button */}
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => setViewSchedule(s)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-border)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#E0E7FF' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)' }}
                    >
                      <Eye size={13} />
                      View Schedule
                    </button>
                    <button
                      onClick={() => setShowCompare(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374151' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}
                    >
                      <GitCompare size={13} />
                      Compare
                    </button>
                    <button
                      onClick={() => handlePDF(s)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ fontSize: 12, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374151' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}
                    >
                      <FileDown size={13} />
                      Save as PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {schedules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <BookmarkCheck size={48} color="#CBD5E1" />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#94A3B8', marginTop: 12 }}>No saved schedules</div>
            <p style={{ fontSize: 13, color: '#CBD5E1', marginTop: 4 }}>Generate and save schedules from the AI Scheduler</p>
          </div>
        )}
      </div>

      {viewSchedule && <ScheduleViewModal schedule={viewSchedule} onClose={() => setViewSchedule(null)} />}
      {showCompare && <CompareModal schedules={schedules} onClose={() => setShowCompare(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
