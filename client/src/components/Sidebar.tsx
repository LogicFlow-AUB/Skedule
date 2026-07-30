import {
  LayoutDashboard,
  Sparkles,
  CalendarDays,
  BookmarkCheck,
  Star,
  UserCheck,
  Users,
  User,
  Settings,
  Bell,
  GraduationCap,
} from 'lucide-react'
import type { Page } from '../App'

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactNode; section: string; badge?: { text: string; color: string; bg: string } }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, section: 'main' },
  { id: 'ai-scheduler', label: 'AI Scheduler', icon: <Sparkles size={16} />, section: 'main', badge: { text: 'AI', color: '#4338CA', bg: '#EEF2FF' } },
  { id: 'manual-builder', label: 'Manual Builder', icon: <CalendarDays size={16} />, section: 'main' },
  { id: 'saved-schedules', label: 'Saved Schedules', icon: <BookmarkCheck size={16} />, section: 'main', badge: { text: '3', color: '#059669', bg: '#ECFDF5' } },
  { id: 'course-reviews', label: 'Course Reviews', icon: <Star size={16} />, section: 'review' },
  { id: 'professor-reviews', label: 'Professor Reviews', icon: <UserCheck size={16} />, section: 'review' },
  { id: 'community', label: 'Community', icon: <Users size={16} />, section: 'social', badge: { text: '3', color: '#10B981', bg: '#ECFDF5' } },
  { id: 'profile', label: 'Profile & Settings', icon: <User size={16} />, section: 'account' },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} />, section: 'account' },
]

const SECTIONS: { key: string; label: string }[] = [
  { key: 'main', label: 'Schedule' },
  { key: 'review', label: 'Reviews' },
  { key: 'social', label: 'Social' },
  { key: 'account', label: 'Account' },
]

interface SidebarProps {
  activePage: Page
  setActivePage: (page: Page) => void
}

export default function Sidebar({ activePage, setActivePage }: SidebarProps) {
  // Profile and Settings both resolve to the same page
  const effectivePage = activePage === 'settings' ? 'profile' : activePage

  return (
    <aside
      className="flex flex-col shrink-0 h-screen overflow-y-auto"
      style={{ width: 232, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div
          className="flex items-center justify-center rounded-xl"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 100%)' }}
        >
          <Sparkles size={16} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>Smart Schedule</div>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, letterSpacing: '0.02em' }}>BUILDER</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((i) => i.section === section.key)
          return (
            <div key={section.key} className="mb-4">
              <div
                className="px-2 mb-1"
                style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                {section.label}
              </div>
              {items.map((item) => {
                const active = effectivePage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150"
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      color: active ? '#4338CA' : '#475569',
                      background: active ? '#EEF2FF' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = '#F8FAFC'
                        e.currentTarget.style.color = '#1E293B'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = '#475569'
                      }
                    }}
                  >
                    <span style={{ color: active ? '#4338CA' : '#94A3B8' }}>{item.icon}</span>
                    {item.label}
                    {item.badge && (
                      <span
                        className="ml-auto rounded-full px-1.5"
                        style={{ fontSize: 9, fontWeight: 700, background: item.badge.bg, color: item.badge.color, border: `1px solid ${item.badge.color}30` }}
                      >
                        {item.badge.text}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User card */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid #F1F5F9' }}>
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors"
          style={{ background: '#F8FAFC' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
        >
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
          >
            <GraduationCap size={16} color="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>Alex Hassan</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>CS • Fall 2025</div>
          </div>
          <button className="shrink-0" style={{ color: '#94A3B8' }}>
            <Bell size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
