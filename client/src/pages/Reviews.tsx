import { useState, useEffect, useContext } from 'react'
import { Search, Star, ThumbsUp, Flag, Filter, TrendingUp, BookOpen, Users, Award, ChevronRight, X, Bookmark, GitCompare, CheckCircle } from 'lucide-react'
import type { Page } from '../App'
import { AppContext } from '../context'

interface CourseCard {
  id: string;
  code: string
  name: string
  department: string
  professor: string
  rating: number
  difficulty: number
  workload: number
  recommendation: number
  avgGpa: string
  enrolled: number
  attribute: string
  reviews: number
}

const COURSES: CourseCard[] = [
  { id: 'EECE 330-1', code: 'EECE 330', name: 'Digital Systems', department: 'Electrical & Computer Eng', professor: 'Dr. Hassan', rating: 4.8, difficulty: 3.2, workload: 3.5, recommendation: 94, avgGpa: '3.4', enrolled: 145, attribute: 'Engineering', reviews: 87 },
  { id: 'EECE 330-2', code: 'EECE 330', name: 'Digital Systems', department: 'Electrical & Computer Eng', professor: 'Dr. Nasser', rating: 3.8, difficulty: 4.2, workload: 4.5, recommendation: 65, avgGpa: '2.8', enrolled: 120, attribute: 'Engineering', reviews: 45 },
  { id: 'MATH 201-1', code: 'MATH 201', name: 'Calculus III', department: 'Mathematics', professor: 'Dr. Khalil', rating: 4.6, difficulty: 4.1, workload: 4.0, recommendation: 88, avgGpa: '3.1', enrolled: 210, attribute: 'Natural Science', reviews: 124 },
  { id: 'PHYS 211-1', code: 'PHYS 211', name: 'Physics II', department: 'Physics', professor: 'Dr. Nassif', rating: 4.9, difficulty: 3.8, workload: 3.6, recommendation: 96, avgGpa: '3.5', enrolled: 178, attribute: 'Natural Science', reviews: 156 },
  { id: 'ENGL 210-1', code: 'ENGL 210', name: 'Technical Writing', department: 'English', professor: 'Dr. Saad', rating: 4.2, difficulty: 2.1, workload: 3.0, recommendation: 82, avgGpa: '3.7', enrolled: 95, attribute: 'Writing', reviews: 63 },
  { id: 'HIST 101-1', code: 'HIST 101', name: 'World Civilizations', department: 'History', professor: 'Dr. Moussa', rating: 4.5, difficulty: 2.5, workload: 2.8, recommendation: 90, avgGpa: '3.6', enrolled: 130, attribute: 'Humanities', reviews: 98 },
  { id: 'ECON 201-1', code: 'ECON 201', name: 'Microeconomics', department: 'Economics', professor: 'Dr. Aziz', rating: 3.9, difficulty: 3.0, workload: 3.2, recommendation: 75, avgGpa: '3.0', enrolled: 180, attribute: 'Social Science', reviews: 112 },
]

const COURSE_REVIEWS: Record<string, { author: string; semester: string; rating: number; text: string; tags: string[]; likes: number }[]> = {
  'EECE 330': [
    { author: 'Karim A.', semester: 'Spring 2025', rating: 5, text: 'Best digital systems professor. Labs are well-organized and exams are fair. Highly recommend.', tags: ['Helpful', 'Project Based'], likes: 45 },
    { author: 'Sara B.', semester: 'Fall 2024', rating: 4, text: 'Good course. Midterm was harder than expected but he curves fairly. Office hours are very helpful.', tags: ['Exam Heavy'], likes: 22 },
    { author: 'Lara M.', semester: 'Spring 2025', rating: 5, text: 'Clear explanations, great slides. One of the most organized courses I have taken.', tags: ['Clear', 'Helpful'], likes: 31 },
  ],
  'MATH 201': [
    { author: 'Nour H.', semester: 'Spring 2025', rating: 4, text: 'Tough course but Dr. Khalil is a great teacher. You will learn a lot if you put in the work.', tags: ['Heavy Workload', 'Challenging'], likes: 31 },
    { author: 'Omar K.', semester: 'Fall 2024', rating: 5, text: 'Surprisingly engaging for a math course. Problem sets are well-chosen and build intuition.', tags: ['Engaging', 'Clear'], likes: 28 },
  ],
  'PHYS 211': [
    { author: 'Lara M.', semester: 'Spring 2025', rating: 5, text: 'Best professor I have had at AUB. Explains every concept clearly and always available during office hours.', tags: ['Helpful', 'Clear Explanations'], likes: 34 },
    { author: 'Jana R.', semester: 'Fall 2024', rating: 4, text: 'Great lecturer, very organized. The lab component adds a lot of value. Highly recommend.', tags: ['Lab Intensive', 'Organized'], likes: 19 },
    { author: 'Ziad T.', semester: 'Fall 2024', rating: 5, text: 'Curved the midterm generously. Final was challenging but fair. Would take again in a heartbeat.', tags: ['Fair', 'Helpful'], likes: 41 },
  ],
  'ENGL 210': [
    { author: 'Jana R.', semester: 'Spring 2025', rating: 4, text: 'Practical writing skills that actually help in other courses. Feedback on essays is very detailed.', tags: ['Writing Intensive', 'Helpful'], likes: 15 },
  ],
  'HIST 101': [
    { author: 'Dina F.', semester: 'Fall 2024', rating: 5, text: 'Fascinating content, Dr. Moussa is a passionate lecturer. Attendance is important but worth it.', tags: ['Attendance Required', 'Engaging'], likes: 27 },
  ],
  'ECON 201': [
    { author: 'Rami S.', semester: 'Spring 2025', rating: 3, text: 'Decent introduction to microeconomics. Exams are multiple-choice heavy. Content is straightforward.', tags: ['Exam Heavy', 'Easy Grade'], likes: 8 },
  ],
}

interface Professor {
  name: string
  department: string
  title: string
  rating: number
  difficulty: number
  wouldRetake: number
  courses: string[]
  tags: string[]
  reviews: { author: string; course: string; semester: string; rating: number; text: string; likes: number }[]
  gradeData: { grade: string; pct: number }[]
}

const PROFESSORS: Professor[] = [
  {
    name: 'Dr. Nassif',
    department: 'Physics',
    title: 'Associate Professor',
    rating: 4.9,
    difficulty: 3.8,
    wouldRetake: 96,
    courses: ['PHYS 211', 'PHYS 212', 'PHYS 311'],
    tags: ['Helpful', 'Clear Explanations', 'Fair Exams', 'Engaging', 'Project Based'],
    reviews: [
      { author: 'Lara M.', course: 'PHYS 211', semester: 'Spring 2025', rating: 5, text: "Best professor I've had at AUB. Explains every concept clearly and is always available during office hours.", likes: 34 },
      { author: 'Omar K.', course: 'PHYS 212', semester: 'Fall 2024', rating: 5, text: 'Dr. Nassif makes physics genuinely interesting. The problem sets are challenging but prepare you well for exams.', likes: 28 },
      { author: 'Jana R.', course: 'PHYS 211', semester: 'Fall 2024', rating: 4, text: 'Great lecturer, very organized. The lab component adds a lot of value. Highly recommend.', likes: 19 },
    ],
    gradeData: [{ grade: 'A', pct: 42 }, { grade: 'B', pct: 34 }, { grade: 'C', pct: 15 }, { grade: 'D', pct: 6 }, { grade: 'F', pct: 3 }],
  },
  {
    name: 'Dr. Hassan',
    department: 'Electrical Engineering',
    title: 'Professor',
    rating: 4.8,
    difficulty: 3.2,
    wouldRetake: 94,
    courses: ['EECE 330', 'EECE 331', 'EECE 430'],
    tags: ['Helpful', 'Exam Heavy', 'Project Based', 'Accessible', 'Funny'],
    reviews: [
      { author: 'Karim A.', course: 'EECE 330', semester: 'Spring 2025', rating: 5, text: 'Best digital systems professor. Very knowledgeable and makes hard topics accessible. Labs are well-organized.', likes: 45 },
      { author: 'Sara B.', course: 'EECE 330', semester: 'Fall 2024', rating: 4, text: 'Good professor. Midterm was harder than expected but he curves fairly. Office hours are very helpful.', likes: 22 },
    ],
    gradeData: [{ grade: 'A', pct: 38 }, { grade: 'B', pct: 30 }, { grade: 'C', pct: 18 }, { grade: 'D', pct: 9 }, { grade: 'F', pct: 5 }],
  },
  {
    name: 'Dr. Khalil',
    department: 'Mathematics',
    title: 'Assistant Professor',
    rating: 4.6,
    difficulty: 4.1,
    wouldRetake: 88,
    courses: ['MATH 201', 'MATH 202', 'MATH 301'],
    tags: ['Heavy Workload', 'Exam Heavy', 'Attendance Required', 'Clear', 'Challenging'],
    reviews: [
      { author: 'Nour H.', course: 'MATH 201', semester: 'Spring 2025', rating: 4, text: "Tough course but Dr. Khalil is a great teacher. You'll learn a lot if you put in the work.", likes: 31 },
    ],
    gradeData: [{ grade: 'A', pct: 28 }, { grade: 'B', pct: 32 }, { grade: 'C', pct: 24 }, { grade: 'D', pct: 11 }, { grade: 'F', pct: 5 }],
  },
]

const FILTERS = ['Highest Rated', 'Lowest Workload', 'Most Popular', 'Easy A', 'Newest Reviews']
const ATTRIBUTES = ['All', 'Writing', 'Humanities', 'Natural Science', 'Social Science', 'Labs', 'Engineering']

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

// ----- Course Review Modal -----
function CourseReviewModal({ course, onClose }: { course: CourseCard; onClose: () => void }) {
  const { userName } = useContext(AppContext)
  const initialReviews = COURSE_REVIEWS[course.code] ?? []
  const [localReviews, setLocalReviews] = useState(initialReviews)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewSemester, setReviewSemester] = useState('Fall 2025')
  const [reviewProf, setReviewProf] = useState(course.professor)

  const handleSubmit = () => {
    if (!reviewText.trim()) return
    const formattedName = userName.split(' ').map((n: string, i: number) => i === 0 ? n : n[0] + '.').join(' ')
    const newReview = {
      author: formattedName,
      semester: reviewSemester,
      rating: reviewRating,
      text: reviewText,
      tags: [reviewProf],
      likes: 0
    }
    setLocalReviews([newReview, ...localReviews])
    setShowReviewForm(false)
    setReviewText('')
    setReviewRating(5)
  }

  const gradeData = [{ grade: 'A', pct: 38 }, { grade: 'B', pct: 30 }, { grade: 'C', pct: 18 }, { grade: 'D', pct: 9 }, { grade: 'F', pct: 5 }]
  const barColors = ['var(--color-primary)', 'var(--color-primary-grad)', '#A5B4FC', 'var(--color-primary-border)', '#E0E7FF']
  const maxPct = Math.max(...gradeData.map((g) => g.pct))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 560, maxHeight: '85vh', background: '#FFFFFF' }}>
        {/* Header */}
        <div className="px-6 py-5" style={{ background: 'var(--color-primary-light)', borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-primary)', color: 'white' }}>{course.code}</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{course.attribute}</span>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{course.name}</h2>
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{course.professor} · {course.department}</p>
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
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: 'Overall Rating', value: course.rating.toString(), color: 'var(--color-primary)' },
              { label: '% Recommend', value: `${course.recommendation}%`, color: '#059669' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-1.5">
            <RatingBar label="Difficulty" value={course.difficulty} color="#D97706" />
            <RatingBar label="Workload" value={course.workload} color="#7C3AED" />
          </div>

          {/* Reviews */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Student Reviews ({localReviews.length})</div>
              <button onClick={() => setShowReviewForm(!showReviewForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold"
                style={{ fontSize: 11, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                Rate Course
              </button>
            </div>

            {showReviewForm && (
              <div className="rounded-xl p-4 mb-4" style={{ background: '#F8FAFC', border: '1px solid #E0E7FF' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Write a Review for {course.code}</div>
                <div className="flex gap-4 mb-3">
                  <div className="flex-1">
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Professor</div>
                    <input type="text" value={reviewProf} onChange={e => setReviewProf(e.target.value)} placeholder="Professor Name" className="w-full rounded-lg px-2 py-1.5 outline-none" style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
                  </div>
                  <div className="flex-1">
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Semester</div>
                    <select value={reviewSemester} onChange={e => setReviewSemester(e.target.value)} className="w-full rounded-lg px-2 py-1.5 outline-none" style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                      <option value="Fall 2025">Fall 2025</option>
                      <option value="Spring 2025">Spring 2025</option>
                      <option value="Fall 2024">Fall 2024</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Rating:</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} fill={i < reviewRating ? "#F59E0B" : "none"} color={i < reviewRating ? "#F59E0B" : "#CBD5E1"} className="cursor-pointer" onClick={() => setReviewRating(i + 1)} />
                    ))}
                  </div>
                </div>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience..." className="w-full rounded-xl p-3 outline-none resize-none"
                  rows={3} style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSubmit} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-opacity" style={{ background: 'var(--color-primary)', color: 'white', opacity: reviewText.trim() ? 1 : 0.5 }}>Submit</button>
                  <button onClick={() => setShowReviewForm(false)} className="py-1.5 px-4 rounded-lg text-xs font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
                </div>
              </div>
            )}

            {localReviews.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '16px 0' }}>No reviews yet.</div>}
            <div className="flex flex-col gap-3">
              {localReviews.map((r, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{r.author}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>{r.semester}</span>
                    </div>
                    <StarRating value={r.rating} size={11} />
                  </div>
                  <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{r.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1 flex-wrap">
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>{t}</span>
                      ))}
                    </div>
                    <div className="ml-auto flex items-center gap-1" style={{ color: '#94A3B8', fontSize: 11 }}>
                      <ThumbsUp size={11} />{r.likes}
                    </div>
                  </div>
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
function CompareCoursesModal({ courses, initialA, initialB, onClose }: { courses: CourseCard[]; initialA: string; initialB: string; onClose: () => void }) {
  const [idA, setIdA] = useState(initialA)
  const [idB, setIdB] = useState(initialB)
  const courseA = courses.find((c) => c.id === idA)!
  const courseB = courses.find((c) => c.id === idB)!

  const COMPARE_FIELDS: { key: keyof CourseCard; label: string; higher: 'better' | 'worse' | 'neutral' }[] = [
    { key: 'rating', label: 'Overall Rating', higher: 'better' },
    { key: 'recommendation', label: 'Recommendation %', higher: 'better' },
    { key: 'difficulty', label: 'Difficulty', higher: 'worse' },
    { key: 'workload', label: 'Workload', higher: 'worse' },
    { key: 'enrolled', label: 'Enrolled Students', higher: 'neutral' },
  ]

  const winner = (a: number, b: number, higher: 'better' | 'worse' | 'neutral') => {
    if (higher === 'neutral') return 'tie'
    if (higher === 'better') return a > b ? 'a' : a < b ? 'b' : 'tie'
    return a < b ? 'a' : a > b ? 'b' : 'tie'
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
            {[{ val: idA, set: setIdA }, { val: idB, set: setIdB }].map((s, i) => (
              <select key={i} value={s.val} onChange={(e) => s.set(e.target.value)}
                className="w-full rounded-xl px-3 py-2 outline-none font-semibold"
                style={{ fontSize: 13, border: '1px solid #E2E8F0', color: '#1E293B', background: '#F8FAFC' }}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.professor})</option>)}
              </select>
            ))}
          </div>

          {/* Course headers */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[courseA, courseB].map((c) => (
              <div key={c.id} className="rounded-2xl p-4" style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>{c.code}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{c.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginTop: 2 }}>{c.professor}</div>
                <div className="flex items-center gap-1 mt-2">
                  <StarRating value={c.rating} size={13} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary)', marginLeft: 4 }}>{c.rating}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
            {COMPARE_FIELDS.map((f, fi) => {
              const va = courseA[f.key] as number
              const vb = courseB[f.key] as number
              const w = winner(va, vb, f.higher)
              return (
                <div key={f.key} className="grid grid-cols-3 items-center"
                  style={{ background: fi % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: fi < COMPARE_FIELDS.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div className="px-4 py-3 text-center font-bold rounded-lg"
                    style={{ fontSize: 14, color: w === 'a' ? '#15803D' : '#374151', background: w === 'a' ? '#F0FDF4' : 'transparent', margin: 4 }}>
                    {f.key === 'recommendation' ? `${va}%` : va}
                    {w === 'a' && <CheckCircle size={12} color="#16A34A" style={{ display: 'inline', marginLeft: 4 }} />}
                  </div>
                  <div className="px-4 py-3 text-center" style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', borderLeft: '1px solid #F1F5F9', borderRight: '1px solid #F1F5F9' }}>
                    {f.label}
                  </div>
                  <div className="px-4 py-3 text-center font-bold rounded-lg"
                    style={{ fontSize: 14, color: w === 'b' ? '#15803D' : '#374151', background: w === 'b' ? '#F0FDF4' : 'transparent', margin: 4 }}>
                    {f.key === 'recommendation' ? `${vb}%` : vb}
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
function ProfessorDetailView({ prof, onClose }: { prof: Professor; onClose: () => void }) {
  const { userName } = useContext(AppContext)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewCourse, setReviewCourse] = useState(prof.courses[0] || 'General')
  const [reviewSemester, setReviewSemester] = useState('Fall 2025')
  const [localReviews, setLocalReviews] = useState(prof.reviews)

  const handleSubmit = () => {
    if (!reviewText.trim()) return
    const formattedName = userName.split(' ').map((n: string, i: number) => i === 0 ? n : n[0] + '.').join(' ')
    const newReview = {
      author: formattedName,
      course: reviewCourse,
      semester: reviewSemester,
      rating: reviewRating,
      text: reviewText,
      likes: 0
    }
    setLocalReviews([newReview, ...localReviews])
    setShowReviewForm(false)
    setReviewText('')
    setReviewRating(5)
  }

  const maxGrade = Math.max(...prof.gradeData.map((g) => g.pct))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-3 flex items-center gap-2 sticky top-0 z-10"
        style={{ background: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #F1F5F9' }}>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ fontSize: 12, fontWeight: 600, color: '#64748B', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          ← Back to Results
        </button>
        <ChevronRight size={14} color="#CBD5E1" />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{prof.name}</span>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-6 mb-6">
          <div className="rounded-2xl flex items-center justify-center shrink-0"
            style={{ width: 88, height: 88, background: 'linear-gradient(135deg, var(--color-primary) 0%, #8B5CF6 100%)', fontSize: 32, fontWeight: 800, color: 'white' }}>
            {prof.name.split(' ').map((w) => w[0]).join('').slice(1)}
          </div>
          <div className="flex-1">
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{prof.name}</h1>
            <div style={{ fontSize: 14, color: '#64748B', marginTop: 2 }}>{prof.title} · {prof.department}</div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {prof.tags.map((t) => (
                <span key={t} className="rounded-full px-2.5 py-1"
                  style={{ fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>{t}</span>
              ))}
            </div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--color-primary)', lineHeight: 1 }}>{prof.rating}</div>
            <StarRating value={prof.rating} size={14} />
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{localReviews.length * 12} ratings</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Overall Rating', value: `${prof.rating}/5`, color: 'var(--color-primary)', sub: 'Excellent' },
            { label: 'Difficulty', value: `${prof.difficulty}/5`, color: '#D97706', sub: 'Moderate' },
            { label: 'Would Retake', value: `${prof.wouldRetake}%`, color: '#059669', sub: 'Highly recommended' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-5 flex flex-col items-center text-center"
              style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Rating Breakdown</div>
            <div className="flex flex-col gap-2">
              <RatingBar label="Helpfulness" value={4.8} color="var(--color-primary)" />
              <RatingBar label="Clarity" value={4.7} color="var(--color-primary-grad)" />
              <RatingBar label="Fairness" value={4.5} color="#10B981" />
              <RatingBar label="Engagement" value={4.6} color="#0EA5E9" />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Student Reviews</div>
            <button onClick={() => setShowReviewForm(!showReviewForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold"
              style={{ fontSize: 12, background: 'var(--color-primary)', color: 'white' }}>
              Rate Professor
            </button>
          </div>

          {showReviewForm && (
            <div className="rounded-2xl p-5 mb-4" style={{ background: '#F8FAFC', border: '1px solid #E0E7FF' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Write a Review</div>
              <div className="flex gap-4 mb-3">
                <div className="flex-1">
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Course</div>
                  <select value={reviewCourse} onChange={e => setReviewCourse(e.target.value)} className="w-full rounded-lg px-2 py-1.5 outline-none" style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                    {prof.courses.map(c => <option key={c} value={c}>{c}</option>)}
                    {!prof.courses.length && <option value="General">General</option>}
                  </select>
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>Semester</div>
                  <select value={reviewSemester} onChange={e => setReviewSemester(e.target.value)} className="w-full rounded-lg px-2 py-1.5 outline-none" style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                    <option value="Fall 2025">Fall 2025</option>
                    <option value="Spring 2025">Spring 2025</option>
                    <option value="Fall 2024">Fall 2024</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Rating:</span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={20} fill={i < reviewRating ? "#F59E0B" : "none"} color={i < reviewRating ? "#F59E0B" : "#CBD5E1"} className="cursor-pointer" onClick={() => setReviewRating(i + 1)} />
                  ))}
                </div>
              </div>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience..." className="w-full rounded-xl p-3 outline-none resize-none"
                rows={3} style={{ fontSize: 12, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
              <div className="flex gap-2 mt-3">
                <button onClick={handleSubmit} className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--color-primary)', color: 'white', opacity: reviewText.trim() ? 1 : 0.5 }}>Submit</button>
                <button onClick={() => setShowReviewForm(false)} className="py-2 px-4 rounded-xl text-sm font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>Cancel</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {localReviews.map((r, i) => (
              <div key={i} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full flex items-center justify-center"
                      style={{ width: 32, height: 32, background: 'var(--color-primary-light)', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                      {r.author.split(' ').map((w) => w[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{r.author}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.course} · {r.semester}</div>
                    </div>
                  </div>
                  <StarRating value={r.rating} />
                </div>
                <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{r.text}</p>
                <div className="flex items-center gap-3 mt-3">
                  <button className="flex items-center gap-1.5 transition-colors" style={{ fontSize: 11, color: '#94A3B8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}>
                    <ThumbsUp size={12} />{r.likes} helpful
                  </button>
                  <button className="flex items-center gap-1.5 transition-colors" style={{ fontSize: 11, color: '#94A3B8' }}
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
export default function Reviews({ activeTab, setPage }: { activeTab: 'course-reviews' | 'professor-reviews', setPage?: (p: Page) => void }) {
  const [tab, setTab] = useState<'courses' | 'professors'>(activeTab === 'professor-reviews' ? 'professors' : 'courses')
  
  useEffect(() => {
    setTab(activeTab === 'professor-reviews' ? 'professors' : 'courses')
  }, [activeTab])

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('Highest Rated')
  const [activeAttribute, setActiveAttribute] = useState('All')
  const [selectedProf, setSelectedProf] = useState<Professor | null>(null)

  // Course interaction state
  const [savedCourses, setSavedCourses] = useState<Set<string>>(new Set())
  const [viewReviewCourse, setViewReviewCourse] = useState<CourseCard | null>(null)
  const [compareModal, setCompareModal] = useState<{ codeA: string; codeB: string } | null>(null)

  const toggleSave = (code: string) => {
    setSavedCourses((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  const filteredCourses = COURSES.filter((c) =>
    (c.code + c.name + c.professor + c.department).toLowerCase().includes(search.toLowerCase()) &&
    (activeAttribute === 'All' || c.attribute === activeAttribute)
  )
  const filteredProfs = PROFESSORS.filter((p) =>
    (p.name + p.department + p.courses.join(' ')).toLowerCase().includes(search.toLowerCase())
  )

  if (selectedProf) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F8FAFC' }}>
        <ProfessorDetailView prof={selectedProf} onClose={() => setSelectedProf(null)} />
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
              <button key={t.id} onClick={() => {
                setTab(t.id as 'courses' | 'professors')
                if (setPage) setPage(t.id === 'courses' ? 'course-reviews' : 'professor-reviews')
              }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md transition-all"
                style={{ fontSize: 13, fontWeight: 600, background: tab === t.id ? '#FFFFFF' : 'transparent', color: tab === t.id ? 'var(--color-primary)' : '#64748B', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            {tab === 'courses' ? `${filteredCourses.length} courses` : `${filteredProfs.length} professors`}
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
              style={{ fontSize: 12, fontWeight: 600, background: activeFilter === f ? 'var(--color-primary)' : '#F1F5F9', color: activeFilter === f ? 'white' : '#64748B', border: activeFilter === f ? '1px solid var(--color-primary)' : '1px solid #E2E8F0' }}>
              {f}
            </button>
          ))}
          <div className="w-px h-4 shrink-0" style={{ background: '#E2E8F0' }} />
          {ATTRIBUTES.map((a) => (
            <button key={a} onClick={() => setActiveAttribute(a)}
              className="shrink-0 rounded-full px-3 py-1.5 transition-all"
              style={{ fontSize: 12, fontWeight: 600, background: activeAttribute === a ? 'var(--color-primary-light)' : 'transparent', color: activeAttribute === a ? 'var(--color-primary)' : '#94A3B8', border: activeAttribute === a ? '1px solid var(--color-primary-border)' : '1px solid transparent' }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'courses' ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {filteredCourses.map((c) => {
              const isSaved = savedCourses.has(c.code)
              return (
                <div key={c.id}
                  className="rounded-2xl p-5 flex flex-col gap-3 transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(67,56,202,0.1)'; e.currentTarget.style.border = '1px solid var(--color-primary-border)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border = '1px solid #F1F5F9' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{c.code}</span>
                        <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>{c.attribute}</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{c.professor} · {c.department}</div>
                    </div>
                    <div className="text-center">
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary)' }}>{c.rating}</div>
                      <StarRating value={c.rating} size={10} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <RatingBar label="Difficulty" value={c.difficulty} color="#D97706" />
                    <RatingBar label="Workload" value={c.workload} color="#7C3AED" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 ml-auto">
                      <div className="rounded-full" style={{ width: 8, height: 8, background: '#10B981' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#059669' }}>{c.recommendation}% recommend</span>
                    </div>
                  </div>

                  {/* Action buttons — all wired */}
                  <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid #F8FAFC' }}>
                    <button
                      onClick={() => setViewReviewCourse(c)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-border)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#E0E7FF' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)' }}>
                      View Reviews
                    </button>
                    <button
                      onClick={() => {
                        const otherCode = filteredCourses.find((x) => x.id !== c.id)?.id ?? filteredCourses[0].id
                        setCompareModal({ codeA: c.id, codeB: otherCode })
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                      style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #F1F5F9' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#374151' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B' }}>
                      <GitCompare size={11} />Compare
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {filteredProfs.map((p) => (
              <div key={p.name}
                className="rounded-2xl p-5 cursor-pointer transition-all"
                style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                onClick={() => setSelectedProf(p)}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(67,56,202,0.1)'; e.currentTarget.style.border = '1px solid var(--color-primary-border)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border = '1px solid #F1F5F9' }}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="rounded-2xl flex items-center justify-center shrink-0"
                    style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--color-primary) 0%, #8B5CF6 100%)', fontSize: 18, fontWeight: 800, color: 'white' }}>
                    {p.name.split(' ').map((w) => w[0]).join('').slice(1)}
                  </div>
                  <div className="flex-1">
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.department}</div>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)' }}>{p.rating}</div>
                    <StarRating value={p.rating} size={10} />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-lg px-2.5 py-1.5 text-center flex-1" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>{p.difficulty}/5</div>
                    <div style={{ fontSize: 10, color: '#92400E', fontWeight: 600 }}>Difficulty</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 text-center flex-1" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#059669' }}>{p.wouldRetake}%</div>
                    <div style={{ fontSize: 10, color: '#065F46', fontWeight: 600 }}>Would Retake</div>
                  </div>
                  <div className="rounded-lg px-2.5 py-1.5 text-center flex-1" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#374151' }}>{p.reviews.length * 12}</div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Ratings</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {p.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>{t}</span>
                  ))}
                  {p.tags.length > 3 && (
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#94A3B8' }}>+{p.tags.length - 3}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    className="w-full py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}>
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewReviewCourse && <CourseReviewModal course={viewReviewCourse} onClose={() => setViewReviewCourse(null)} />}
      {compareModal && (
        <CompareCoursesModal
          courses={COURSES}
          initialA={compareModal.codeA}
          initialB={compareModal.codeB}
          onClose={() => setCompareModal(null)}
        />
      )}
    </div>
  )
}
