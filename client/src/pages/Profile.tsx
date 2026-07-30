import { useState } from 'react'
import { Star, BookOpen, Award, Edit3, TrendingUp, Heart, MessageSquare, Bookmark, Trophy, Target, GraduationCap, Clock, Bell, Lock, Eye, Palette, Shield, ChevronRight } from 'lucide-react'

const SAVED_SCHEDULES = [
  { name: 'Schedule A — Preferred', credits: 15, courses: ['EECE 330', 'MATH 201', 'PHYS 211', 'EECE 351', 'CHEM 201'], days: 'Mon–Thu', saved: 'Oct 15' },
  { name: 'Schedule B — Friday Free', credits: 15, courses: ['EECE 330', 'MATH 201', 'PHYS 211', 'EECE 351'], days: 'Mon–Thu', saved: 'Oct 12' },
  { name: 'Schedule C — Light Load', credits: 12, courses: ['MATH 201', 'PHYS 211', 'ENGL 210', 'HIST 101'], days: 'Tue–Thu', saved: 'Oct 8' },
]

const COMPLETED = [
  { code: 'EECE 230', name: 'Circuits I', grade: 'A', semester: 'Spring 2025', credits: 3 },
  { code: 'MATH 101', name: 'Calculus I', grade: 'A+', semester: 'Fall 2024', credits: 3 },
  { code: 'PHYS 101', name: 'Physics I', grade: 'B+', semester: 'Fall 2024', credits: 3 },
  { code: 'CS 101', name: 'Intro to CS', grade: 'A', semester: 'Fall 2024', credits: 3 },
  { code: 'ENGL 101', name: 'Academic Writing', grade: 'A-', semester: 'Fall 2024', credits: 3 },
  { code: 'MATH 201', name: 'Calculus II', grade: 'B+', semester: 'Spring 2025', credits: 3 },
]

const FAV_PROFS = [
  { name: 'Dr. Nassif', dept: 'Physics', rating: 4.9, course: 'PHYS 211' },
  { name: 'Dr. Hassan', dept: 'EECE', rating: 4.8, course: 'EECE 330' },
  { name: 'Dr. Khalil', dept: 'Math', rating: 4.6, course: 'MATH 201' },
]

const ACHIEVEMENTS = [
  { icon: '🏆', title: 'Top Reviewer', desc: 'Posted 10+ helpful reviews', earned: true },
  { icon: '🎯', title: 'Perfect Planner', desc: 'Generated 5 optimized schedules', earned: true },
  { icon: '💡', title: 'Community Helper', desc: 'Answered 25 questions', earned: true },
  { icon: '⭐', title: 'Star Student', desc: 'Maintain GPA above 3.5', earned: true },
  { icon: '🤝', title: 'Social Butterfly', desc: 'Connect with 20+ friends', earned: false },
  { icon: '📚', title: 'Course Expert', desc: 'Rate 20+ courses', earned: false },
]

const GRADE_COLORS: Record<string, string> = {
  'A+': '#059669', 'A': '#059669', 'A-': '#10B981',
  'B+': '#0EA5E9', 'B': '#0EA5E9', 'B-': '#38BDF8',
  'C+': '#F59E0B', 'C': '#F59E0B',
}

function StatCard({ value, label, sub, color }: { value: string; label: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'courses' | 'reviews' | 'settings'>('overview')

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Profile header */}
      <div className="px-8 pt-8 pb-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-end gap-6 mb-6">
          {/* Avatar */}
          <div className="relative">
            <div className="rounded-3xl flex items-center justify-center"
              style={{ width: 96, height: 96, background: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 100%)', fontSize: 32, fontWeight: 800, color: 'white', border: '4px solid white', boxShadow: '0 4px 16px rgba(67,56,202,0.3)' }}>
              AH
            </div>
            <div className="absolute -bottom-1 -right-1 rounded-full p-1.5"
              style={{ background: '#10B981', border: '2px solid white' }}>
              <GraduationCap size={12} color="white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Alex Hassan</h1>
              <div className="flex gap-1.5">
                {[
                  { label: 'Top Contributor', color: '#F59E0B' },
                  { label: 'Honor Student', color: '#059669' },
                ].map((b) => (
                  <span key={b.label} className="rounded-full px-2.5 py-1"
                    style={{ fontSize: 11, fontWeight: 700, background: b.color + '20', color: b.color, border: `1px solid ${b.color}40` }}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>Computer Science</span>
              <span style={{ color: '#E2E8F0' }}>·</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>Minor: Mathematics</span>
              <span style={{ color: '#E2E8F0' }}>·</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>Class of 2027</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <TrendingUp size={12} color="#16A34A" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>GPA: 3.72</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                <BookOpen size={12} color="#4338CA" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>18/120 Credits</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Clock size={12} color="#64748B" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Fall 2025</span>
              </div>
            </div>
          </div>

          {/* Edit button */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors mb-4"
            style={{ fontSize: 13, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
            <Edit3 size={14} />
            Edit Profile
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'schedules', label: 'Saved Schedules' },
            { id: 'courses', label: 'Completed Courses' },
            { id: 'reviews', label: 'My Reviews' },
            { id: 'settings', label: '⚙ Settings' },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
              className="px-4 py-2.5 font-semibold transition-all relative"
              style={{ fontSize: 13, color: activeTab === t.id ? '#4338CA' : '#64748B' }}>
              {t.label}
              {activeTab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: '#4338CA' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-5 gap-4">
              <StatCard value="3.72" label="GPA" sub="Above average" color="#4338CA" />
              <StatCard value="18" label="Credits Done" sub="of 120 required" color="#059669" />
              <StatCard value="6" label="Courses Completed" sub="This year" color="#0EA5E9" />
              <StatCard value="14" label="Reviews Written" sub="Community rank #12" color="#F59E0B" />
              <StatCard value="89" label="Reputation" sub="Top 15%" color="#7C3AED" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Achievements */}
              <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy size={16} color="#F59E0B" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Achievements</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ACHIEVEMENTS.map((a) => (
                    <div key={a.title} className="rounded-xl p-3 flex flex-col items-center text-center"
                      style={{ background: a.earned ? '#F8FAFC' : '#FAFAFA', border: `1px solid ${a.earned ? '#F1F5F9' : '#F1F5F9'}`, opacity: a.earned ? 1 : 0.4 }}>
                      <span style={{ fontSize: 24, marginBottom: 4 }}>{a.icon}</span>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4, marginTop: 1 }}>{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Favorite professors */}
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Heart size={16} color="#EF4444" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Favorite Professors</div>
                  </div>
                  {FAV_PROFS.map((p) => (
                    <div key={p.name} className="flex items-center gap-3 mb-3 last:mb-0">
                      <div className="rounded-full flex items-center justify-center shrink-0"
                        style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 100%)', fontSize: 12, fontWeight: 700, color: 'white' }}>
                        {p.name.split(' ').map((w) => w[0]).join('').slice(1)}
                      </div>
                      <div className="flex-1">
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.dept} · {p.course}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{p.rating}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Wishlist */}
                <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={16} color="#4338CA" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Course Wishlist</div>
                  </div>
                  {['EECE 430 — Advanced VLSI', 'CS 415 — Machine Learning', 'MATH 301 — Complex Analysis'].map((c) => (
                    <div key={c} className="flex items-center gap-2 mb-2 last:mb-0">
                      <Bookmark size={12} color="#4338CA" />
                      <span style={{ fontSize: 12, color: '#374151' }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Community stats */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Community Activity</div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: <MessageSquare size={16} />, value: '14', label: 'Reviews Written', color: '#4338CA' },
                  { icon: <Heart size={16} />, value: '234', label: 'Helpful Votes', color: '#EF4444' },
                  { icon: <MessageSquare size={16} />, value: '47', label: 'Comments', color: '#059669' },
                  { icon: <Award size={16} />, value: 'Top 15%', label: 'Community Rank', color: '#F59E0B' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="flex flex-col gap-4">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Saved Schedules</div>
            {SAVED_SCHEDULES.map((s, i) => (
              <div key={i} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Saved {s.saved} · {s.days} · {s.credits} credits</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: '#EEF2FF', color: '#4338CA' }}>Register</button>
                    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>Compare</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.courses.map((c) => (
                    <span key={c} className="rounded-lg px-2.5 py-1" style={{ fontSize: 12, fontWeight: 700, background: '#EEF2FF', color: '#4338CA' }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'courses' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Completed Courses</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              {COMPLETED.map((c) => (
                <div key={c.code} className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="rounded-xl flex items-center justify-center shrink-0"
                    style={{ width: 44, height: 44, background: (GRADE_COLORS[c.grade] ?? '#94A3B8') + '20', color: GRADE_COLORS[c.grade] ?? '#94A3B8', fontSize: 16, fontWeight: 800 }}>
                    {c.grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4338CA' }}>{c.code}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.semester} · {c.credits} credits</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>My Reviews</div>
            {[
              { course: 'PHYS 101', prof: 'Dr. Haddad', rating: 5, text: 'Excellent introduction to physics. Dr. Haddad makes difficult concepts approachable with real-world examples.', likes: 24, semester: 'Fall 2024' },
              { course: 'CS 101', prof: 'Dr. Abi Nader', rating: 4, text: 'Good intro course. Covers the basics well. Could use more challenging problem sets but great for beginners.', likes: 17, semester: 'Fall 2024' },
              { course: 'MATH 101', prof: 'Dr. Khalil', rating: 5, text: 'One of the best math professors. Explains every step clearly and the practice problems are well-chosen.', likes: 31, semester: 'Fall 2024' },
            ].map((r, i) => (
              <div key={i} className="rounded-2xl p-5 mb-4"
                style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FF', color: '#4338CA' }}>{r.course}</span>
                    <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>{r.prof} · {r.semester}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={12} fill={j < r.rating ? '#F59E0B' : 'none'} color={j < r.rating ? '#F59E0B' : '#CBD5E1'} />
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{r.text}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Heart size={12} color="#94A3B8" />
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{r.likes} found this helpful</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- SETTINGS TAB (merged, not a separate page) ---- */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl flex flex-col gap-6">
            {/* Notification preferences */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Bell size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notifications</div>
              </div>
              {[
                { label: 'Registration reminders', sub: 'Alert when registration opens for your courses', on: true },
                { label: 'Friend schedule shared', sub: 'When a friend shares their schedule with you', on: true },
                { label: 'New professor reviews', sub: 'Reviews posted for professors you follow', on: false },
                { label: 'Community mentions', sub: 'When someone mentions you in a post', on: true },
                { label: 'Study group updates', sub: 'Activity in groups you have joined', on: false },
              ].map((n) => (
                <NotifToggle key={n.label} {...n} />
              ))}
            </div>

            {/* Privacy */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Eye size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Privacy</div>
              </div>
              {[
                { label: 'Profile visibility', sub: 'Who can see your full profile', value: 'Friends only' },
                { label: 'Schedule sharing', sub: 'Who can view your current schedule', value: 'Friends only' },
                { label: 'GPA visibility', sub: 'Show GPA on public profile', value: 'Hidden' },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.sub}</div>
                  </div>
                  <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                    style={{ fontSize: 12, fontWeight: 600, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                    {p.value}<ChevronRight size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Account */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Account & Security</div>
              </div>
              {[
                { label: 'Email address', value: 'alex.hassan@aub.edu.lb', icon: <Lock size={14} /> },
                { label: 'Student ID', value: '202300234', icon: <GraduationCap size={14} /> },
                { label: 'Password', value: '••••••••••', icon: <Lock size={14} /> },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#94A3B8' }}>{a.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{a.label}</div>
                      <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>{a.value}</div>
                    </div>
                  </div>
                  <button className="text-xs font-semibold rounded-lg px-3 py-1.5"
                    style={{ color: '#4338CA', background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>

            {/* Appearance */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Palette size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Appearance</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>Color Theme</div>
                <div className="flex gap-2">
                  {[
                    { name: 'Indigo', color: '#4338CA', active: true },
                    { name: 'Emerald', color: '#059669', active: false },
                    { name: 'Sky', color: '#0284C7', active: false },
                    { name: 'Violet', color: '#7C3AED', active: false },
                  ].map((t) => (
                    <button key={t.name} className="flex flex-col items-center gap-1.5">
                      <div className="rounded-xl" style={{ width: 36, height: 36, background: t.color, border: t.active ? `3px solid ${t.color}` : '3px solid transparent', outline: t.active ? '2px solid white' : 'none', boxShadow: t.active ? `0 0 0 3px ${t.color}` : 'none' }} />
                      <span style={{ fontSize: 10, color: t.active ? t.color : '#94A3B8', fontWeight: t.active ? 700 : 500 }}>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl p-5" style={{ background: '#FFF5F5', border: '1px solid #FECACA' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', marginBottom: 12 }}>Danger Zone</div>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Delete account</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Permanently remove your account and all data. This cannot be undone.</div>
                </div>
                <button className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NotifToggle({ label, sub, on }: { label: string; sub: string; on: boolean }) {
  const [enabled, setEnabled] = useState(on)
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>
      </div>
      <button
        onClick={() => setEnabled(!enabled)}
        className="rounded-full transition-all shrink-0"
        style={{ width: 40, height: 22, background: enabled ? '#4338CA' : '#E2E8F0', position: 'relative' }}
      >
        <div className="absolute top-1 rounded-full transition-all"
          style={{ width: 14, height: 14, background: 'white', left: enabled ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}
