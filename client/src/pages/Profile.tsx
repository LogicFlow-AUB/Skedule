import { useState, useContext } from 'react'
import { Star, BookOpen, Edit3, Clock, Bell, Lock, Eye, Palette, Shield, ChevronRight, GraduationCap, Heart, Target, Bookmark, MessageSquare, Award } from 'lucide-react'
import { AppContext } from '../context'

const SAVED_SCHEDULES = [
  { name: 'Schedule A — Preferred', credits: 15, courses: ['EECE 330', 'MATH 201', 'PHYS 211', 'EECE 351', 'CHEM 201'], days: 'Mon–Thu', saved: 'Oct 15' },
  { name: 'Schedule B — Friday Free', credits: 15, courses: ['EECE 330', 'MATH 201', 'PHYS 211', 'EECE 351'], days: 'Mon–Thu', saved: 'Oct 12' },
  { name: 'Schedule C — Light Load', credits: 12, courses: ['MATH 201', 'PHYS 211', 'ENGL 210', 'HIST 101'], days: 'Tue–Thu', saved: 'Oct 8' },
]

function PrivacySetting({ label, sub, initialValue, options }: { label: string, sub: string, initialValue: string, options: string[] }) {
  const [val, setVal] = useState(initialValue)
  const nextVal = () => {
    const idx = options.indexOf(val)
    setVal(options[(idx + 1) % options.length])
  }
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>
      </div>
      <button onClick={nextVal} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
        style={{ fontSize: 12, fontWeight: 600, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
        {val}<ChevronRight size={12} />
      </button>
    </div>
  )
}

export default function Profile() {
  const { userName, setUserName, theme, setTheme } = useContext(AppContext)
  const [activeTab, setActiveTab] = useState<'schedules' | 'reviews' | 'settings'>('schedules')
  const [isEditing, setIsEditing] = useState(false)
  const [major, setMajor] = useState('Computer Science')
  const [minor, setMinor] = useState('Mathematics')

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Profile header */}
      <div className="px-8 pt-8 pb-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-end gap-6 mb-6">
          {/* Avatar */}
          <div className="relative">
            <div className="rounded-3xl flex items-center justify-center"
              style={{ width: 96, height: 96, background: 'linear-gradient(135deg, var(--color-primary) 0%, #8B5CF6 100%)', fontSize: 32, fontWeight: 800, color: 'white', border: '4px solid white', boxShadow: '0 4px 16px rgba(67,56,202,0.3)' }}>
              {userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 rounded-full p-1.5"
              style={{ background: '#10B981', border: '2px solid white' }}>
              <GraduationCap size={12} color="white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-3 mb-1">
              {isEditing ? (
                <input value={userName} onChange={(e) => setUserName(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 outline-none text-sm font-bold text-slate-900" style={{ fontSize: 24 }} />
              ) : (
                <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>{userName}</h1>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {isEditing ? (
                <>
                  <input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Major" className="rounded-md border border-slate-300 px-2 py-1 outline-none text-sm font-medium" />
                  <span style={{ color: '#E2E8F0' }}>·</span>
                  <input value={minor} onChange={(e) => setMinor(e.target.value)} placeholder="Minor" className="rounded-md border border-slate-300 px-2 py-1 outline-none text-sm font-medium" />
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>{major}</span>
                  <span style={{ color: '#E2E8F0' }}>·</span>
                  <span style={{ fontSize: 14, color: '#64748B' }}>Minor: {minor}</span>
                </>
              )}
              <span style={{ color: '#E2E8F0' }}>·</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>Class of 2027</span>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Clock size={12} color="#64748B" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Fall 2025</span>
              </div>
            </div>
          </div>

          {/* Edit button */}
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors mb-4"
            style={{ fontSize: 13, background: isEditing ? 'var(--color-primary)' : '#F1F5F9', color: isEditing ? 'white' : '#64748B', border: isEditing ? 'none' : '1px solid #E2E8F0' }}>
            <Edit3 size={14} />
            {isEditing ? 'Save Changes' : 'Edit Profile'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'schedules', label: 'Saved Schedules' },
            { id: 'reviews', label: 'My Reviews' },
            { id: 'settings', label: '⚙ Settings' },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)}
              className="px-4 py-2.5 font-semibold transition-all relative"
              style={{ fontSize: 13, color: activeTab === t.id ? 'var(--color-primary)' : '#64748B' }}>
              {t.label}
              {activeTab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
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
                    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>Register</button>
                    <button className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: '#F1F5F9', color: '#64748B' }}>Compare</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {s.courses.map((c) => (
                    <span key={c} className="rounded-lg px-2.5 py-1" style={{ fontSize: 12, fontWeight: 700, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
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
                    <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{r.course}</span>
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
                <Bell size={16} color="var(--color-primary)" />
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
                <Eye size={16} color="var(--color-primary)" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Privacy</div>
              </div>
              <PrivacySetting label="Profile visibility" sub="Who can see your full profile" initialValue="Friends only" options={['Public', 'Friends only', 'Private']} />
              <PrivacySetting label="Schedule sharing" sub="Who can view your current schedule" initialValue="Friends only" options={['Public', 'Friends only', 'Private']} />
            </div>

            {/* Appearance */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Palette size={16} color="var(--color-primary)" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Appearance</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>Color Theme</div>
                <div className="flex gap-2">
                  {[
                    { name: 'Indigo', color: '#4338CA' },
                    { name: 'Emerald', color: '#059669' },
                    { name: 'Sky', color: '#0284C7' },
                    { name: 'Violet', color: '#7C3AED' },
                    { name: 'Baby Pink', color: '#EC4899' },
                    { name: 'Baby Blue', color: '#38BDF8' },
                    { name: 'Navy', color: '#1E3A8A' },
                    { name: 'Red', color: '#DC2626' },
                  ].map((t) => {
                    const active = theme === t.name
                    return (
                      <button key={t.name} onClick={() => setTheme(t.name)} className="flex flex-col items-center gap-1.5">
                        <div className="rounded-xl" style={{ width: 36, height: 36, background: t.color, border: active ? `3px solid ${t.color}` : '3px solid transparent', outline: active ? '2px solid white' : 'none', boxShadow: active ? `0 0 0 3px ${t.color}` : 'none' }} />
                        <span style={{ fontSize: 10, color: active ? t.color : '#94A3B8', fontWeight: active ? 700 : 500 }}>{t.name}</span>
                      </button>
                    )
                  })}
                </div>
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
        style={{ width: 40, height: 22, background: enabled ? 'var(--color-primary)' : '#E2E8F0', position: 'relative' }}
      >
        <div className="absolute top-1 rounded-full transition-all"
          style={{ width: 14, height: 14, background: 'white', left: enabled ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}
