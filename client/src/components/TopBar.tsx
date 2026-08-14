import { useState, useContext } from 'react'
import { Bell, MessageSquare, ChevronRight } from 'lucide-react'
import type { Page } from '../App'
import { AppContext } from '../context'

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  'ai-scheduler': 'AI Scheduler',
  'manual-builder': 'Manual Builder',
  'saved-schedules': 'Saved Schedules',
  'course-reviews': 'Course Reviews',
  'professor-reviews': 'Professor Reviews',
  community: 'Community',
  friends: 'Community',
  profile: 'Profile & Settings',
  settings: 'Profile & Settings',
}

export default function TopBar({ activePage }: { activePage: Page }) {
  const { userName } = useContext(AppContext)
  const [showNotifications, setShowNotifications] = useState(false)
  const initials = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header
      className="flex items-center gap-4 px-6 shrink-0"
      style={{
        height: 56,
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #F1F5F9',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mr-2 flex-1">
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Smart Schedule</span>
        <ChevronRight size={12} color="#CBD5E1" />
        <span style={{ fontSize: 13, color: '#1E293B', fontWeight: 600 }}>{PAGE_TITLES[activePage]}</span>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="flex items-center justify-center rounded-lg transition-colors relative"
            style={{ width: 34, height: 34, color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Bell size={16} />
            <span
              className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
              style={{ width: 14, height: 14, background: '#EF4444', fontSize: 8, fontWeight: 700, color: 'white' }}
            >
              3
            </span>
          </button>
          {showNotifications && (
            <div
              className="absolute right-0 top-full mt-2 rounded-xl shadow-xl overflow-hidden"
              style={{ width: 320, background: '#FFFFFF', border: '1px solid #E2E8F0', zIndex: 100 }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Notifications</div>
              </div>
              {[
                { icon: '📅', text: 'Registration opens in 3 days for Fall 2025', time: '2h ago', unread: true },
                { icon: '👥', text: 'Sarah K. shared her schedule with you', time: '4h ago', unread: true },
                { icon: '⭐', text: 'New review posted for Prof. Khalil', time: '1d ago', unread: true },
              ].map((n, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                  style={{ background: n.unread ? '#F8FAFC' : 'transparent', borderBottom: '1px solid #F8FAFC' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.unread ? '#F8FAFC' : 'transparent' }}
                >
                  <span style={{ fontSize: 18 }}>{n.icon}</span>
                  <div className="flex-1">
                    <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{n.time}</div>
                  </div>
                  {n.unread && (
                    <div className="shrink-0 rounded-full mt-1" style={{ width: 6, height: 6, background: 'var(--color-primary)' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Avatar */}
        <button
          className="rounded-full flex items-center justify-center ml-1"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--color-primary-grad) 0%, #8B5CF6 100%)', fontSize: 12, fontWeight: 700, color: 'white' }}
        >
          {initials}
        </button>
      </div>
    </header>
  )
}
