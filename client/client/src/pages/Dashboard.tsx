import { Sparkles, CalendarDays, BookmarkCheck, Star, Users, TrendingUp, ChevronRight, Zap, Award } from 'lucide-react'
import type { Page } from '../App'
import { useContext } from 'react'
import { AppContext } from '../context'

interface DashboardProps {
  setPage: (p: Page) => void
}

const QUICK_STATS = [
  { label: 'Credits Enrolled', value: '15', sub: 'Fall 2025', color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
  { label: 'Saved Schedules', value: '3', sub: 'View all →', color: '#059669', bg: '#ECFDF5' },
  { label: 'Courses Reviewed', value: '14', sub: '', color: '#F59E0B', bg: '#FFFBEB' },
]

export default function Dashboard({ setPage }: DashboardProps) {
  const { userName } = useContext(AppContext)
  
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Welcome banner */}
      <div
        className="px-8 py-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-grad) 60%, #8B5CF6 100%)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 rounded-full opacity-10"
          style={{ width: 200, height: 200, background: 'white' }} />
        <div className="absolute -bottom-12 -right-24 rounded-full opacity-5"
          style={{ width: 300, height: 300, background: 'white' }} />

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginBottom: 4 }}>
              {greeting}, {userName.split(' ')[0]} 👋
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
              style={{ background: '#FFFFFF', color: 'var(--color-primary)', fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
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
        <div className="grid grid-cols-3 gap-4">
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
                style={{ background: 'var(--color-primary-light)', border: '1px solid var(--color-primary-border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#E0E7FF'; e.currentTarget.style.transform = 'translateX(2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-primary-light)'; e.currentTarget.style.transform = 'translateX(0)' }}
              >
                <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-grad) 100%)', boxShadow: '0 2px 8px rgba(67,56,202,0.3)' }}>
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

          {/* Explore */}
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Explore</div>
            <div className="grid grid-cols-2 gap-3 h-[calc(100%-32px)]">
              {[
                { label: 'Course Reviews', page: 'course-reviews' as Page, icon: <Star size={18} />, color: '#F59E0B', bg: '#FFFBEB' },
                { label: 'Professor Reviews', page: 'professor-reviews' as Page, icon: <Award size={18} />, color: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
                { label: 'Community', page: 'community' as Page, icon: <Users size={18} />, color: '#10B981', bg: '#ECFDF5' },
                { label: 'My Profile', page: 'profile' as Page, icon: <Zap size={18} />, color: '#8B5CF6', bg: '#F5F3FF' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setPage(item.page)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all"
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
        </div>
      </div>
    </div>
  )
}
