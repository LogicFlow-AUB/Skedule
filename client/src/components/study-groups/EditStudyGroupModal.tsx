import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { api, type CourseSummary } from '../../lib/api'
import type { StudyGroup } from '../../data/studyGroups'
import MeetingTimePicker from './MeetingTimePicker'

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  color: '#1E293B',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '9px 12px',
  outline: 'none',
}

function initialCourse(group: StudyGroup): CourseSummary {
  return {
    id: group.courseId ?? 0,
    code: group.courseCode,
    title: group.courseName,
    department: null,
    college: null,
    level: null,
    credits: '',
    attributes: [],
    enrolledCount: 0,
    reviewCount: 0,
    averageRating: null,
    averageDifficulty: null,
    averageWorkload: null,
    wouldRetakePercentage: null,
  }
}

export default function EditStudyGroupModal({
  group,
  onChanged,
  onClose,
}: {
  group: StudyGroup
  onChanged: () => void
  onClose: () => void
}) {
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [courseOpen, setCourseOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const latest = useRef(0)

  const [query, setQuery] = useState(group.courseCode)
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary>(() => initialCourse(group))
  const [name, setName] = useState(group.name)
  const [bio, setBio] = useState(group.description)
  const [days, setDays] = useState<number[]>(group.meeting?.days ?? [])
  const [startTime, setStartTime] = useState<string | null>(group.meeting?.startTime ?? null)
  const [endTime, setEndTime] = useState<string | null>(group.meeting?.endTime ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = selectedCourse.id ? selectedCourse : null

  useEffect(() => {
    if (!courseOpen) { setCourses([]); return }
    const id = ++latest.current
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      api.courses.list({ search: query.trim() || undefined, limit: 100 })
        .then((res) => { if (!cancelled && id === latest.current) setCourses(res.data) })
        .catch(() => { if (!cancelled && id === latest.current) setCourses([]) })
        .finally(() => { if (!cancelled && id === latest.current) setSearching(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, courseOpen])

  const toggleDay = (index: number) => {
    setDays((current) => current.includes(index) ? current.filter((d) => d !== index) : [...current, index].sort())
  }

  // Meeting times are optional. If either a start or end time is chosen, both
  // must be set and the range must be valid (end after start).
  const hasStart = Boolean(startTime)
  const hasEnd = Boolean(endTime)
  const timePending = hasStart !== hasEnd
  const timeInvalid = hasStart && hasEnd && startTime! >= endTime!
  const canSubmit = Boolean(
    selected &&
    selected.id &&
    name.trim() &&
    !timePending &&
    !timeInvalid &&
    !submitting,
  )

  const submit = async () => {
    if (!canSubmit || !selected) return
    setSubmitting(true)
    setError(null)
    try {
      await api.studyGroups.update(group.id, {
        name: name.trim(),
        courseId: selected.id,
        bio: bio.trim() || undefined,
        meetingDays: days.length ? days : undefined,
        // Send null explicitly so a cleared time range is removed on the backend.
        startTime: startTime ?? null,
        endTime: endTime ?? null,
      })
      onChanged()
      onClose()
    } catch {
      setError('Failed to save changes. Please try again.')
      setSubmitting(false)
    }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="edit-group-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="rounded-2xl overflow-hidden w-full" style={{ maxWidth: 520, background: '#FFFFFF', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
      <div className="px-6 py-5 flex items-start justify-between" style={{ background: '#EEF2FF', borderBottom: '1px solid #E0E7FF' }}><div><h2 id="edit-group-title" style={{ fontSize: 19, fontWeight: 800, color: '#0F172A' }}>Edit Study Group</h2><p style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>Update your group's details.</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5" style={{ color: '#64748B' }}><X size={18} /></button></div>
      <div className="p-6 space-y-4">
        <div>
          <label htmlFor="eg-course" style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5, display: 'block' }}>Course</label>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={inputStyle}>
              <Search size={13} color="#94A3B8" />
              <input id="eg-course" value={query} onFocus={() => setCourseOpen(true)} onChange={(e) => { setQuery(e.target.value); setCourseOpen(true) }} placeholder="Search for a course..." className="flex-1 min-w-0 bg-transparent outline-none" style={{ fontSize: 12, color: '#1E293B' }} />
            </div>
            {courseOpen && <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-y-auto shadow-xl z-30" style={{ maxHeight: 180, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>{searching ? <div className="p-3 text-center text-xs" style={{ color: '#94A3B8' }}>Searching...</div> : courses.length === 0 ? <div className="p-3 text-center text-xs" style={{ color: '#94A3B8' }}>No matching courses</div> : courses.map((course) => { const picked = selectedCourse?.id === course.id; return <button key={course.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2" onClick={() => { setSelectedCourse(course); setQuery(course.code); setCourseOpen(false) }}><div className="min-w-0"><div style={{ fontSize: 11, fontWeight: 800, color: '#4338CA' }}>{course.code}</div><div className="truncate" style={{ fontSize: 10, color: '#64748B' }}>{course.title}</div></div>{picked && <Check size={14} color="#15803D" />}</button> })}</div>}
          </div>
          {selected && <div className="mt-2 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}><span style={{ fontSize: 11, fontWeight: 700, color: '#4338CA' }}>{selected.code} – {selected.title}</span><button aria-label="Clear course" onClick={() => { setSelectedCourse({ ...initialCourse(group), id: 0 }); setQuery(''); setCourseOpen(false) }} style={{ color: '#64748B' }}><X size={13} /></button></div>}
        </div>
        <div>
          <label htmlFor="eg-name" style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5, display: 'block' }}>Group name</label>
          <input id="eg-name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="eg-bio" style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5, display: 'block' }}>Bio / description</label>
          <textarea id="eg-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5, display: 'block' }}>Meeting day(s)</label>
          <div className="flex flex-wrap gap-1.5">{DAY_OPTIONS.map((day, index) => { const active = days.includes(index); return <button key={day} type="button" onClick={() => toggleDay(index)} className="rounded-lg px-2.5 py-1.5 font-semibold transition-colors" style={{ fontSize: 10, color: active ? '#4338CA' : '#64748B', background: active ? '#EEF2FF' : '#F8FAFC', border: active ? '1px solid #C7D2FE' : '1px solid #E2E8F0' }}>{day}</button> })}</div>
        </div>
        <MeetingTimePicker startTime={startTime} endTime={endTime} onChange={(s, e) => { setStartTime(s); setEndTime(e) }} />
        {timePending && <p style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>Set both a start and end time, or leave both blank.</p>}
        {timeInvalid && <p style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>End time must be after the start time.</p>}
        {error && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>{error}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
          <button onClick={submit} disabled={!canSubmit} className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: canSubmit ? '#4338CA' : '#C7D2FE', color: '#FFFFFF' }}>{submitting ? <Loader2 size={13} className="animate-spin" /> : null}{submitting ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  </div>
}
