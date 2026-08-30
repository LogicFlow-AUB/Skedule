import { Sparkles, CalendarDays, BookmarkCheck, Star, Users, ChevronRight, Zap, Award } from 'lucide-react'
import type { Page } from '../App'
import { useAuth } from '../lib/auth'

interface DashboardProps {
  setPage: (p: Page) => void
}

export default function Dashboard({ setPage }: DashboardProps) {
  const { user } = useAuth()

  const localPart = user?.email ? user.email.split('@')[0] ?? 'student' : 'student'
  const firstName = localPart.charAt(0).toUpperCase() + localPart.slice(1)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

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
              {greeting}, {firstName} 👋
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2 }}>
              Build your perfect semester.
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>
              Plan smarter. Build your perfect semester with AI-powered tools.
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
              Optimized Builder
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Optimized Builder</div>
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
                  <div style={{ fontSize: 12, color: '#64748B' }}>View your saved schedules</div>
                </div>
                <ChevronRight size={16} color="#38BDF8" />
              </button>
            </div>
          </div>

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

        </div>
      </div>
    </div>
  )
}
