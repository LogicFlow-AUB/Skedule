import { useEffect, useMemo, useState } from 'react'
import { Search, Star, ThumbsUp, Flag, Filter, TrendingUp, BookOpen, Users, Award, ChevronRight, X, Bookmark, GitCompare, CheckCircle, Loader2 } from 'lucide-react'
import { api, type CourseSummary, type CourseReview, type ProfessorSummary, type ProfessorReview, type GradeDistributionRow } from '../lib/api'
import { displayName, timeAgo } from '../lib/format'

const FILTERS = ['Highest Rated', 'Lowest Workload', 'Most Popular', 'Easy A', 'Newest Reviews']
const ATTRIBUTES = ['All', 'Writing', 'Humanities', 'Natural Science', 'Social Science', 'Labs', 'Engineering']

const SORT_MAP: Record<string, { sort: 'name' | 'rating' | 'difficulty' | 'workload' | 'popularity'; order: 'asc' | 'desc' }> = {
  'Highest Rated': { sort: 'rating', order: 'desc' },
  'Lowest Workload': { sort: 'workload', order: 'asc' },
  'Most Popular': { sort: 'popularity', order: 'desc' },
  'Easy A': { sort: 'difficulty', order: 'asc' },
  'Newest Reviews': { sort: 'name', order: 'asc' },
}

const PROFESSOR_SORT_MAP: Record<string, { sort: 'name' | 'rating' | 'difficulty' | 'popularity'; order: 'asc' | 'desc' }> = {
  'Highest Rated': { sort: 'rating', order: 'desc' },
  'Most Popular': { sort: 'popularity', order: 'desc' },
  'Lowest Workload': { sort: 'name', order: 'asc' },
  'Easy A': { sort: 'difficulty', order: 'asc' },
  'Newest Reviews': { sort: 'name', order: 'asc' },
}

function StarRating({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} fill={i < Math.round(value) ? '#F59E0B' : 'none'} color={i < Math.round(value) ? '#F59E0B' : '#CBD5E1'} />
      ))}
    </div>
  )
}

function RatingBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 11, color: '#64748B', width: 80, flexShrink: 0 }}>{label}</span>
      <div className="flex-1 rounded-full h-2" style={{ background: '#F1F5F9' }}>
        <div className="h-2 rounded-full" style={{ width: `${(value / 5) * 100}%`, background: color }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', width: 28, textAlign: 'right' }}>{value.toFixed(1)}</span>
    </div>
  )
}

function CourseInitials({ firstName, lastName, size, fontSize }: { firstName: string; lastName: string; size: number; fontSize: number }) {
  return (
    <div className="rounded-2xl flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 100%)', fontSize, fontWeight: 800, color: 'white' }}>
      {(firstName[0] ?? '') + (lastName[0] ?? '')}
    </div>
  )
}

// ----- Course Review Modal -----
function CourseReviewModal({ course, onClose }: { course: CourseSummary; onClose: () => void }) {
  const [reviews, setReviews] = useState<CourseReview[]>([])
  const [gradeData, setGradeData] = useState<GradeDistributionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [reviewsRes, gradesRes] = await Promise.all([
          api.courses.reviews(course.code, 1, 50),
          api.courses.gradeDistribution(course.code),
        ])
        if (!cancelled) {
          setReviews(reviewsRes.data)
          setGradeData(gradesRes.data)
        }
      } catch {
        // leave empty state
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
  }, [course.code])

  const barColors = ['#4338CA', '#6366F1', '#A5B4FC', '#C7D2FE', '#E0E7FF']
  const maxPct = Math.max(1, ...gradeData.map((g) => g.percentage ?? 0))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 560, maxHeight: '85vh', background: '#FFFFFF' }}>
        {/* Header */}
        <div className="px-6 py-5" style={{ background: '#EEF2FF', borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: '#4338CA', color: 'white' }}>{course.code}</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{course.attributes[0] ?? '—'}</span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{course.title}</h2>
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{course.department ?? 'General'} · {course.credits} credits</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Overall Rating', value: course.averageRating === null ? '—' : course.averageRating.toFixed(1), color: '#4338CA' },
              { label: 'Reviews', value: String(course.reviewCount), color: '#059669' },
              { label: '% Recommend', value: course.wouldRetakePercentage === null ? '—' : `${course.wouldRetakePercentage}%`, color: '#D97706' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-1.5">
            <RatingBar label="Difficulty" value={course.averageDifficulty ?? 0} color="#D97706" />
            <RatingBar label="Workload" value={course.averageWorkload ?? 0} color="#7C3AED" />
          </div>

          {/* Grade distribution */}
          <div className="mb-5">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Grade Distribution</div>
            <div className="flex items-end gap-2" style={{ height: 60 }}>
              {gradeData.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8' }}>No grade data available.</div>}
              {gradeData.map((g, i) => (
                <div key={g.grade} className="flex-1 flex flex-col items-center gap-1">
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>{g.percentage}%</div>
                  <div className="w-full rounded-t-md" style={{ height: `${((g.percentage ?? 0) / maxPct) * 44}px`, background: barColors[i % barColors.length] }} />
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>{g.grade}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Student Reviews ({reviews.length})</div>
            {loading && <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin" style={{ color: '#94A3B8' }} /></div>}
            {!loading && reviews.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No reviews yet.</div>}
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{displayName(r.author?.firstName, r.author?.lastName)}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>{timeAgo(r.createdAt)}</span>
                    </div>
                    <StarRating value={r.rating} size={11} />
                  </div>
                  {r.difficulty !== null && (
                    <div className="mb-1">
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#FFFBEB', color: '#B45309' }}>
                        Difficulty {r.difficulty}/5
                      </span>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{r.comment ?? 'No comment.'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- Compare Courses Modal -----
function CompareCoursesModal({ courses, initialA, initialB, onClose }: { courses: CourseSummary[]; initialA: string; initialB: string; onClose: () => void }) {
  const [codeA, setCodeA] = useState(initialA)
  const [codeB, setCodeB] = useState(initialB)
  const courseA = courses.find((c) => c.code === codeA)
  const courseB = courses.find((c) => c.code === codeB)

  const COMPARE_FIELDS: { key: 'averageRating' | 'wouldRetakePercentage' | 'averageDifficulty' | 'averageWorkload' | 'enrolledCount'; label: string; higher: 'better' | 'worse' | 'neutral'; suffix?: string }[] = [
    { key: 'averageRating', label: 'Overall Rating', higher: 'better' },
    { key: 'wouldRetakePercentage', label: 'Recommendation %', higher: 'better', suffix: '%' },
    { key: 'averageDifficulty', label: 'Difficulty', higher: 'worse' },
    { key: 'averageWorkload', label: 'Workload', higher: 'worse' },
    { key: 'enrolledCount', label: 'Enrolled Students', higher: 'neutral' },
  ]

  const winner = (a: number, b: number, higher: 'better' | 'worse' | 'neutral') => {
    if (higher === 'neutral') return 'tie'
    if (higher === 'better') return a > b ? 'a' : a < b ? 'b' : 'tie'
    return a < b ? 'a' : a > b ? 'b' : 'tie'
  }

  if (!courseA || !courseB) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 700, maxHeight: '85vh', background: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Compare Courses</div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {/* Selectors */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[{ val: codeA, set: setCodeA }, { val: codeB, set: setCodeB }].map((s, i) => (
              <select key={i} value={s.val} onChange={(e) => s.set(e.target.value)}
                className="w-full rounded-xl px-3 py-2 outline-none font-semibold"
                style={{ fontSize: 13, border: '1px solid #E2E8F0', color: '#1E293B', background: '#F8FAFC' }}>
                {courses.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
              </select>
            ))}
          </div>

          {/* Course headers */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[courseA, courseB].map((c) => (
              <div key={c.code} className="rounded-2xl p-4" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4338CA' }}>{c.code}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{c.title}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{c.department ?? '—'}</div>
                <div className="flex items-center gap-1 mt-2">
                  <StarRating value={c.averageRating ?? 0} size={13} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#4338CA', marginLeft: 4 }}>{c.averageRating === null ? '—' : c.averageRating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
            {COMPARE_FIELDS.map((f, fi) => {
              const va = courseA[f.key] ?? 0
              const vb = courseB[f.key] ?? 0
              const w = winner(va, vb, f.higher)
              return (
                <div key={f.key} className="grid grid-cols-3 items-center"
                  style={{ background: fi % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: fi < COMPARE_FIELDS.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div className="px-4 py-3 text-center font-bold rounded-lg"
                    style={{ fontSize: 14, color: w === 'a' ? '#15803D' : '#374151', background: w === 'a' ? '#F0FDF4' : 'transparent', margin: 4 }}>
                    {`${va}${f.suffix ?? ''}`}
                    {w === 'a' && <CheckCircle size={12} color="#16A34A" style={{ display: 'inline', marginLeft: 4 }} />}
                  </div>
                  <div className="px-4 py-3 text-center" style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', borderLeft: '1px solid #F1F5F9', borderRight: '1px solid #F1F5F9' }}>
                    {f.label}
                  </div>
                  <div className="px-4 py-3 text-center font-bold rounded-lg"
                    style={{ fontSize: 14, color: w === 'b' ? '#15803D' : '#374151', background: w === 'b' ? '#F0FDF4' : 'transparent', margin: 4 }}>
                    {`${vb}${f.suffix ?? ''}`}
                    {w === 'b' && <CheckCircle size={12} color="#16A34A" style={{ display: 'inline', marginLeft: 4 }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- Professor Detail View -----
type ProfessorDetail = ProfessorSummary & {
  courses?: { courses?: { id: number; subject: string; course_number: string; title: string } | null }[]
  ratingBreakdown?: { rating: number; count: number }[]
}

function ProfessorDetailView({ professorId, onClose }: { professorId: number; onClose: () => void }) {
  const [prof, setProf] = useState<ProfessorDetail | null>(null)
  const [reviews, setReviews] = useState<ProfessorReview[]>([])
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [profRes, reviewsRes] = await Promise.all([
          api.professors.get(professorId),
          api.professors.reviews(professorId, 1, 50),
        ])
        if (!cancelled) {
          setProf(profRes.data as ProfessorDetail)
          setReviews(reviewsRes.data)
        }
      } catch {
        if (!cancelled) {
          setMessage('Could not load professor.')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [professorId])

  const barColors = ['#4338CA', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE']
  const breakdown = prof?.ratingBreakdown ?? []
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count))

  const coursesTaught = useMemo(() => {
    const codes = new Set<string>()
    for (const section of prof?.courses ?? []) {
      const course = section?.courses
      if (course) {
        codes.add(`${course.subject} ${course.course_number}`)
      }
    }
    return [...codes]
  }, [prof])

  async function submitReview(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      const { data: created } = await api.professors.createReview(professorId, { rating, comment: comment.trim() || undefined })
      setReviews((prev) => [created, ...prev])
      setComment('')
      setShowReviewForm(false)
      setMessage('Review submitted. Thanks!')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  async function likeReview(reviewId: number) {
    try {
      await api.professors.likeReview(professorId, reviewId)
    } catch {
      // best-effort
    }
  }

  async function reportReview(reviewId: number) {
    const reason = window.prompt('Reason for reporting this review:')
    if (!reason) {
      return
    }
    try {
      await api.professors.reportReview(professorId, reviewId, reason)
      setMessage('Review reported.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not report review.')
    }
  }

  if (!prof) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAFC' }}>
        <div className="p-6 flex items-center gap-2" style={{ color: '#64748B', fontSize: 13 }}>
          <Loader2 size={16} className="animate-spin" /> Loading professor...
        </div>
      </div>
    )
  }

  const name = displayName(prof.firstName, prof.lastName)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-3 flex items-center gap-2 sticky top-0 z-10"
        style={{ background: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #F1F5F9' }}>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          ← Back to Results
        </button>
        <ChevronRight size={14} color="#CBD5E1" />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{name}</span>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-6 mb-6">
          <CourseInitials firstName={prof.firstName} lastName={prof.lastName} size={88} fontSize={32} />
          <div className="flex-1">
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{name}</h1>
            <div style={{ fontSize: 14, color: '#64748B', marginTop: 2 }}>{[prof.title, prof.department].filter(Boolean).join(' · ')}</div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {prof.title && (
                <span className="rounded-full px-2.5 py-1"
                  style={{ fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>{prof.title}</span>
              )}
              {prof.department && (
                <span className="rounded-full px-2.5 py-1"
                  style={{ fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>{prof.department}</span>
              )}
            </div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 48, fontWeight: 800, color: '#4338CA', lineHeight: 1 }}>{prof.averageRating === null ? '—' : prof.averageRating.toFixed(1)}</div>
            <StarRating value={prof.averageRating ?? 0} size={14} />
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{prof.reviewCount} ratings</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Overall Rating', value: prof.averageRating === null ? '—' : `${prof.averageRating.toFixed(1)}/5`, color: '#4338CA' },
            { label: 'Difficulty', value: prof.averageDifficulty === null ? '—' : `${prof.averageDifficulty.toFixed(1)}/5`, color: '#D97706' },
            { label: 'Would Retake', value: prof.wouldRetakePercentage === null ? '—' : `${prof.wouldRetakePercentage}%`, color: '#059669' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-5 flex flex-col items-center text-center"
              style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Rating Breakdown</div>
          {breakdown.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8' }}>No ratings yet.</div>}
          <div className="flex flex-col gap-2">
            {breakdown.map((b) => (
              <div key={b.rating} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#64748B', width: 24, flexShrink: 0, fontWeight: 600 }}>{b.rating}★</span>
                <div className="flex-1 rounded-full h-2" style={{ background: '#F1F5F9' }}>
                  <div className="h-2 rounded-full" style={{ width: `${(b.count / maxCount) * 100}%`, background: barColors[5 - b.rating] }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', width: 28, textAlign: 'right' }}>{b.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>Courses Taught</div>
          {coursesTaught.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8' }}>No course data available.</div>}
          <div className="flex gap-2 flex-wrap">
            {coursesTaught.map((c) => (
              <span key={c} className="rounded-lg px-3 py-1.5"
                style={{ fontSize: 12, fontWeight: 600, background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>{c}</span>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Student Reviews</div>
            <button onClick={() => setShowReviewForm(!showReviewForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold"
              style={{ fontSize: 12, background: '#4338CA', color: 'white' }}>
              Rate Professor
            </button>
          </div>

          {message && (
            <div className="rounded-xl px-3.5 py-2.5 mb-4" style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', fontSize: 12, fontWeight: 600, color: '#3730A3' }}>
              {message}
            </div>
          )}

          {showReviewForm && (
            <form onSubmit={submitReview} className="rounded-2xl p-5 mb-4" style={{ background: '#F8FAFC', border: '1px solid #E0E7FF' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Write a Review</div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 12, color: '#64748B' }}>Rating:</span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button key={i} type="button" onClick={() => setRating(i + 1)}>
                      <Star size={20} fill={i < rating ? '#F59E0B' : 'none'} color={i < rating ? '#F59E0B' : '#CBD5E1'} className="cursor-pointer" />
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience..." className="w-full rounded-xl p-3 outline-none resize-none"
                rows={3} style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
              <div className="flex gap-2 mt-3">
                <button type="submit" disabled={submitting} className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: '#4338CA', color: 'white' }}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowReviewForm(false)} className="py-2 px-4 rounded-xl text-sm font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full flex items-center justify-center"
                      style={{ width: 32, height: 32, background: '#EEF2FF', fontSize: 12, fontWeight: 700, color: '#4338CA' }}>
                      {(r.author?.firstName?.[0] ?? '') + (r.author?.lastName?.[0] ?? '') || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{displayName(r.author?.firstName, r.author?.lastName)}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{timeAgo(r.createdAt)}</div>
                    </div>
                  </div>
                  <StarRating value={r.rating} />
                </div>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{r.comment ?? 'No comment.'}</p>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => void likeReview(r.id)} className="flex items-center gap-1.5 transition-colors" style={{ fontSize: 11, color: '#94A3B8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#4338CA' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}>
                    <ThumbsUp size={12} />Helpful
                  </button>
                  <button onClick={() => void reportReview(r.id)} className="flex items-center gap-1.5 transition-colors" style={{ fontSize: 11, color: '#94A3B8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}>
                    <Flag size={12} />Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- Main Reviews -----
export default function Reviews({ activeTab }: { activeTab: 'course-reviews' | 'professor-reviews' }) {
  const [tab, setTab] = useState<'courses' | 'professors'>(activeTab === 'professor-reviews' ? 'professors' : 'courses')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Highest Rated')
  const [activeAttribute, setActiveAttribute] = useState('All')
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [professors, setProfessors] = useState<ProfessorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedProfId, setSelectedProfId] = useState<number | null>(null)
  const [savedCourses, setSavedCourses] = useState<Set<string>>(new Set())
  const [viewReviewCourse, setViewReviewCourse] = useState<CourseSummary | null>(null)
  const [compareModal, setCompareModal] = useState<{ codeA: string; codeB: string } | null>(null)

  useEffect(() => {
    setTab(activeTab === 'professor-reviews' ? 'professors' : 'courses')
    setSelectedProfId(null)
  }, [activeTab])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        if (tab === 'courses') {
          const sort = SORT_MAP[activeFilter] ?? SORT_MAP['Highest Rated']
          const page = await api.courses.list({
            search: search || undefined,
            attribute: activeAttribute === 'All' ? undefined : activeAttribute,
            sort: sort.sort,
            order: sort.order,
            limit: 50,
          })
          if (!cancelled) {
            setCourses(page.data)
          }
        } else {
          const sort = PROFESSOR_SORT_MAP[activeFilter] ?? PROFESSOR_SORT_MAP['Highest Rated']
          const page = await api.professors.list({
            search: search || undefined,
            sort: sort.sort,
            order: sort.order,
            limit: 50,
          })
          if (!cancelled) {
            setProfessors(page.data)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load data.')
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
  }, [tab, search, activeFilter, activeAttribute])

  const toggleSave = async (code: string) => {
    const isSaved = savedCourses.has(code)
    try {
      if (isSaved) {
        await api.courses.unsave(code)
      } else {
        await api.courses.save(code)
      }
      setSavedCourses((prev) => {
        const next = new Set(prev)
        if (isSaved) {
          next.delete(code)
        } else {
          next.add(code)
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update saved course.')
    }
  }

  if (selectedProfId) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F8FAFC' }}>
        <ProfessorDetailView professorId={selectedProfId} onClose={() => setSelectedProfId(null)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Header */}
      <div className="px-6 py-4 shrink-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex rounded-lg p-0.5" style={{ background: '#F1F5F9' }}>
            {[{ id: 'courses', label: 'Course Reviews', icon: <BookOpen size={13} /> }, { id: 'professors', label: 'Professor Reviews', icon: <Award size={13} /> }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id as 'courses' | 'professors')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md transition-all"
                style={{ fontSize: 13, fontWeight: 600, background: tab === t.id ? '#FFFFFF' : 'transparent', color: tab === t.id ? '#4338CA' : '#64748B', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            {tab === 'courses' ? `${courses.length} courses` : `${professors.length} professors`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Search size={15} color="#94A3B8" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'courses' ? 'Search courses, professors, departments...' : 'Search professors, departments, courses...'}
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 13, color: '#374151' }} />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ fontSize: 13, fontWeight: 600, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <Filter size={14} />Filters
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className="shrink-0 rounded-full px-3 py-1.5 transition-all"
              style={{ fontSize: 12, fontWeight: 600, background: activeFilter === f ? '#4338CA' : '#F1F5F9', color: activeFilter === f ? 'white' : '#64748B', border: activeFilter === f ? '1px solid #4338CA' : '1px solid #E2E8F0' }}>
              {f}
            </button>
          ))}
          {tab === 'courses' && (
            <>
              <div className="w-px h-4 shrink-0" style={{ background: '#E2E8F0' }} />
              {ATTRIBUTES.map((a) => (
                <button key={a} onClick={() => setActiveAttribute(a)}
                  className="shrink-0 rounded-full px-3 py-1.5 transition-all"
                  style={{ fontSize: 12, fontWeight: 600, background: activeAttribute === a ? '#EEF2FF' : 'transparent', color: activeAttribute === a ? '#4338CA' : '#94A3B8', border: activeAttribute === a ? '1px solid #C7D2FE' : '1px solid transparent' }}>
                  {a}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: '#94A3B8' }} /></div>
        )}
        {!loading && error && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
            {error}
          </div>
        )}
        {!loading && tab === 'courses' && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {courses.map((c) => {
              const isSaved = savedCourses.has(c.code)
              return (
                <div key={c.code}
                  className="rounded-2xl p-5 flex flex-col gap-3 transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(67,56,202,0.1)'; e.currentTarget.style.border = '1px solid #C7D2FE' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border = '1px solid #F1F5F9' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FF', color: '#4338CA' }}>{c.code}</span>
                        {c.attributes[0] && <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>{c.attributes[0]}</span>}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{c.department ?? 'General'} · {c.credits} credits</div>
                    </div>
                    <div className="text-center">
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#4338CA' }}>{c.averageRating === null ? '—' : c.averageRating.toFixed(1)}</div>
                      <StarRating value={c.averageRating ?? 0} size={10} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <RatingBar label="Difficulty" value={c.averageDifficulty ?? 0} color="#D97706" />
                    <RatingBar label="Workload" value={c.averageWorkload ?? 0} color="#7C3AED" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <TrendingUp size={11} color="#64748B" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{c.reviewCount} reviews</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <Users size={11} color="#64748B" />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{c.enrolledCount} enrolled</span>
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <div className="rounded-full" style={{ width: 8, height: 8, background: '#10B981' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>{c.wouldRetakePercentage === null ? '—' : `${c.wouldRetakePercentage}%`} recommend</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid #F8FAFC' }}>
                    <button
                      onClick={() => setViewReviewCourse(c)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#E0E7FF' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#EEF2FF' }}>
                      View Reviews
                    </button>
                    <button
                      onClick={() => {
                        const otherCode = courses.find((x) => x.code !== c.code)?.code ?? c.code
                        setCompareModal({ codeA: c.code, codeB: otherCode })
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                      style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #F1F5F9' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374151' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}>
                      <GitCompare size={11} />Compare
                    </button>
                    <button
                      onClick={() => void toggleSave(c.code)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                      style={{
                        background: isSaved ? '#F0FDF4' : '#F8FAFC',
                        color: isSaved ? '#15803D' : '#64748B',
                        border: isSaved ? '1px solid #86EFAC' : '1px solid #F1F5F9',
                      }}>
                      <Bookmark size={11} fill={isSaved ? '#15803D' : 'none'} />
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!loading && tab === 'professors' && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {professors.map((p) => (
              <div key={p.id}
                className="rounded-2xl p-5 cursor-pointer transition-all"
                style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                onClick={() => setSelectedProfId(p.id)}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(67,56,202,0.1)'; e.currentTarget.style.border = '1px solid #C7D2FE' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border = '1px solid #F1F5F9' }}>
                <div className="flex items-start gap-4 mb-4">
                  <CourseInitials firstName={p.firstName} lastName={p.lastName} size={52} fontSize={18} />
                  <div className="flex-1">
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{displayName(p.firstName, p.lastName)}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.department}</div>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#4338CA' }}>{p.averageRating === null ? '—' : p.averageRating.toFixed(1)}</div>
                    <StarRating value={p.averageRating ?? 0} size={10} />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-lg px-2.5 py-1.5 text-center flex-1" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>{p.averageDifficulty === null ? '—' : `${p.averageDifficulty}/5`}</div>
                    <div style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>Difficulty</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 text-center flex-1" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{p.wouldRetakePercentage === null ? '—' : `${p.wouldRetakePercentage}%`}</div>
                    <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>Would Retake</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 text-center flex-1" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#374151' }}>{p.reviewCount}</div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Ratings</div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProfId(p.id)}
                  className="w-full py-2 rounded-xl text-sm font-semibold"
                  style={{ background: '#4338CA', color: 'white' }}>
                  View Profile
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewReviewCourse && <CourseReviewModal course={viewReviewCourse} onClose={() => setViewReviewCourse(null)} />}
      {compareModal && (
        <CompareCoursesModal
          courses={courses}
          initialA={compareModal.codeA}
          initialB={compareModal.codeB}
          onClose={() => setCompareModal(null)}
        />
      )}
    </div>
  )
}
