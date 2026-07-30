import { Sparkles, CalendarDays, BookmarkCheck, Star, Users, TrendingUp, Clock, ChevronRight, Calendar, Zap, Award } from 'lucide-react'
import type { Page } from '../App'

interface DashboardProps {
  setPage: (p: Page) => void
}

const QUICK_STATS = [
  { label: 'Credits Enrolled', value: '15', sub: 'Fall 2025', color: '#4338CA', bg: '#EEF2FF' },
  { label: 'Saved Schedules', value: '3', sub: 'View all →', color: '#059669', bg: '#ECFDF5' },
  { label: 'Courses Reviewed', value: '14', sub: 'Community rank #12', color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Friends Online', value: '3', sub: '5 total friends', color: '#0EA5E9', bg: '#F0F9FF' },
]

const UPCOMING = [
  { event: 'Fall 2025 Registration', date: 'Nov 3, 9:00 AM', type: 'registration', color: '#EF4444', bg: '#FEF2F2' },
  { event: 'Add/Drop Period Ends', date: 'Nov 17, 5:00 PM', type: 'deadline', color: '#D97706', bg: '#FFFBEB' },
  { event: 'EECE 330 Lab Section', date: 'Oct 28, 2:00 PM', type: 'class', color: '#4338CA', bg: '#EEF2FF' },
  { event: 'MATH 201 Midterm', date: 'Nov 5, 10:00 AM', type: 'exam', color: '#7C3AED', bg: '#F5F3FF' },
]

const RECENT_ACTIVITY = [
  { text: 'Sarah K. shared her Fall 2025 schedule with you', time: '2h ago', icon: '📅' },
  { text: 'New review posted for Dr. Nassif (PHYS 211)', time: '5h ago', icon: '⭐' },
  { text: 'EECE 330 seat availability: 3 seats left in Section 01', time: '1d ago', icon: '⚠️' },
]

export default function Dashboard({ setPage }: DashboardProps) {
  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Welcome banner */}
      <div
        className="px-8 py-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #8B5CF6 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 rounded-full opacity-10"
          style={{ width: 200, height: 200, background: 'white' }} />
        <div className="absolute -bottom-12 -right-24 rounded-full opacity-5"
          style={{ width: 300, height: 300, background: 'white' }} />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginBottom: 4 }}>
              Good morning, Alex 👋
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
              Build your perfect semester.
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
              Registration opens in <strong style={{ color: 'white' }}>12 days</strong>. Your schedule is ready to register.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPage('ai-scheduler')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all"
              style={{ background: '#FFFFFF', color: '#4338CA', fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)' }}
            >
              <Sparkles size={16} />
              AI Scheduler
            </button>
            <button
              onClick={() => setPage('manual-builder')}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: 14, border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <CalendarDays size={16} />
              Manual Builder
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 flex flex-col gap-6">
        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-4">
          {QUICK_STATS.map((s) => (
            <button
              key={s.label}
              onClick={() => s.label === 'Saved Schedules' ? setPage('saved-schedules') : undefined}
              className="rounded-2xl p-4 text-left flex items-start gap-3 transition-all"
              style={{
                background: '#FFFFFF',
                border: '1px solid #F1F5F9',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                cursor: s.label === 'Saved Schedules' ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (s.label === 'Saved Schedules') {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,150,105,0.12)'
                  e.currentTarget.style.border = '1px solid #A7F3D0'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
                e.currentTarget.style.border = '1px solid #F1F5F9'
              }}
            >
              <div className="rounded-xl p-2" style={{ background: s.bg }}>
                {s.label === 'Credits Enrolled' && <TrendingUp size={16} color={s.color} />}
                {s.label === 'Saved Schedules' && <BookmarkCheck size={16} color={s.color} />}
                {s.label === 'Courses Reviewed' && <Star size={16} color={s.color} />}
                {s.label === 'Friends Online' && <Users size={16} color={s.color} />}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: s.label === 'Saved Schedules' ? s.color : '#94A3B8', marginTop: 1, fontWeight: s.label === 'Saved Schedules' ? 600 : 400 }}>{s.sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Schedule shortcuts */}
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Schedule Tools</div>
            </div>
            <div className="flex flex-col gap-3">
              {/* AI Scheduler card */}
              <button
                onClick={() => setPage('ai-scheduler')}
                className="flex items-center gap-4 p-4 rounded-xl text-left transition-all group"
                style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#E0E7FF'; e.currentTarget.style.transform = 'translateX(2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.transform = 'translateX(0)' }}
              >
                <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)', boxShadow: '0 2px 8px rgba(67,56,202,0.3)' }}>
                  <Sparkles size={20} color="white" />
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>AI Scheduler</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Generate optimized schedules with AI preferences</div>
                </div>
                <ChevronRight size={16} color="#818CF8" />
              </button>

              {/* Manual Builder card — different destination */}
              <button
                onClick={() => setPage('manual-builder')}
                className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#DCFCE7'; e.currentTarget.style.transform = 'translateX(2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.transform = 'translateX(0)' }}
              >
                <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', boxShadow: '0 2px 8px rgba(5,150,105,0.3)' }}>
                  <CalendarDays size={20} color="white" />
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Manual Builder</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Drag and drop courses to build your own schedule</div>
                </div>
                <ChevronRight size={16} color="#34D399" />
              </button>

              {/* Saved Schedules card */}
              <button
                onClick={() => setPage('saved-schedules')}
                className="flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.transform = 'translateX(2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.transform = 'translateX(0)' }}
              >
                <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }}>
                  <BookmarkCheck size={20} color="white" />
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Saved Schedules</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>3 schedules saved · Ready to compare & register</div>
                </div>
                <ChevronRight size={16} color="#38BDF8" />
              </button>
            </div>
          </div>

          {/* Upcoming */}
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Upcoming</div>
              <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div className="rounded-full" style={{ width: 6, height: 6, background: '#EF4444' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444' }}>Registration in 12d</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {UPCOMING.map((u, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: u.bg, border: `1px solid ${u.color}20` }}>
                  <div className="rounded-lg p-1.5 shrink-0" style={{ background: u.color + '20' }}>
                    <Calendar size={13} color={u.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.event}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{u.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {/* Explore */}
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Explore</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Course Reviews', page: 'course-reviews' as Page, icon: <Star size={18} />, color: '#F59E0B', bg: '#FFFBEB' },
                { label: 'Professor Reviews', page: 'professor-reviews' as Page, icon: <Award size={18} />, color: '#4338CA', bg: '#EEF2FF' },
                { label: 'Community', page: 'community' as Page, icon: <Users size={18} />, color: '#10B981', bg: '#ECFDF5' },
                { label: 'My Profile', page: 'profile' as Page, icon: <Zap size={18} />, color: '#8B5CF6', bg: '#F5F3FF' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setPage(item.page)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                  style={{ background: item.bg, border: `1px solid ${item.color}20` }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${item.color}25` }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div className="rounded-xl p-2.5" style={{ background: item.color + '25', color: item.color }}>{item.icon}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', textAlign: 'center' }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Recent Activity</div>
              <button onClick={() => setPage('community')} style={{ fontSize: 12, color: '#4338CA', fontWeight: 600 }}>View all</button>
            </div>
            <div className="flex flex-col gap-3">
              {RECENT_ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span style={{ fontSize: 20, lineHeight: 1, marginTop: 1 }}>{a.icon}</span>
                  <div className="flex-1">
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{a.text}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} color="#94A3B8" />
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{a.time}</span>
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
