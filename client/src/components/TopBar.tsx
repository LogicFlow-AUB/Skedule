import { useState, useEffect, useCallback } from 'react'
import { Bell, ChevronRight, LogOut } from 'lucide-react'
import type { Page } from '../App'
import { useAuth } from '../lib/auth'
import { api, type Notification } from '../lib/api'

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  'ai-scheduler': 'AI Scheduler',
  'manual-builder': 'Manual Builder',
  'saved-schedules': 'Saved Schedules',
  'course-reviews': 'Course Reviews',
  'professor-reviews': 'Professor Reviews',
  community: 'Community',
  'common-free-time': 'Common Free Time',
  friends: 'Community',
  profile: 'Profile & Settings',
  settings: 'Profile & Settings',
}

export default function TopBar({ activePage }: { activePage: Page }) {
  const { user, logout } = useAuth()
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const [listRes, countRes] = await Promise.all([
        api.notifications.list(1, 10),
        api.notifications.unreadCount(),
      ])
      setNotifications(listRes.data)
      setUnreadCount(countRes.data.count)
    } catch {
      // silently ignore — notifications are non-critical
    }
  }, [user])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const toggleNotifications = async () => {
    const next = !showNotifications
    setShowNotifications(next)
    if (next && unreadCount > 0) {
      try {
        await api.notifications.markAllRead()
        setUnreadCount(0)
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      } catch {
        // ignore
      }
    }
  }

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      try {
        await api.notifications.markRead(n.id)
        setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item))
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // ignore
      }
    }
  }

  function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - Date.parse(dateStr)) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  function notificationIcon(type: string): string {
    switch (type) {
      case 'friend_request_received':
      case 'friend_request_accepted':
        return '\u{1F465}'
      case 'post_liked':
        return '\u{1F44D}'
      case 'post_commented':
        return '\u{1F4AC}'
      case 'review_liked':
        return '\u{2B50}'
      case 'schedule_shared':
        return '\u{1F4C5}'
      default:
        return '\u{1F514}'
    }
  }

  const localPart = user?.email ? user.email.split('@')[0] ?? '' : ''
  const initials = (localPart.slice(0, 2) || 'ST').toUpperCase()

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
      <div className="flex items-center gap-1.5 mr-2">
        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Smart Schedule</span>
        <ChevronRight size={12} color="#CBD5E1" />
        <span style={{ fontSize: 13, color: '#1E293B', fontWeight: 600 }}>{PAGE_TITLES[activePage]}</span>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => void toggleNotifications()}
            className="flex items-center justify-center rounded-lg transition-colors relative"
            style={{ width: 34, height: 34, color: '#64748B' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                style={{ width: 14, height: 14, background: '#EF4444', fontSize: 8, fontWeight: 700, color: 'white' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div
              className="absolute right-0 top-full mt-2 rounded-xl shadow-xl overflow-hidden"
              style={{ width: 320, background: '#FFFFFF', border: '1px solid #E2E8F0', zIndex: 100 }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Notifications</div>
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center" style={{ fontSize: 12, color: '#94A3B8' }}>
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => void handleNotificationClick(n)}
                    className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                    style={{ background: n.read ? 'transparent' : '#F8FAFC', borderBottom: '1px solid #F8FAFC' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? 'transparent' : '#F8FAFC' }}
                  >
                    <span style={{ fontSize: 18 }}>{notificationIcon(n.type)}</span>
                    <div className="flex-1">
                      <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.read && (
                      <div className="shrink-0 rounded-full mt-1" style={{ width: 6, height: 6, background: '#4338CA' }} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <button
          className="rounded-full flex items-center justify-center ml-1"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: 12, fontWeight: 700, color: 'white' }}
        >
          {initials}
        </button>

        {/* Logout */}
        <button
          onClick={() => void logout()}
          title="Sign out"
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 34, height: 34, color: '#64748B' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}
