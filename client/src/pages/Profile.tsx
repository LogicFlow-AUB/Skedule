import { useEffect, useState } from 'react'
import {
  Star, Edit3, GitCompare,
  Bell, Lock, Eye, Palette, Shield, X, CheckCircle,
} from 'lucide-react'
import { api, type UserProfile, type UserStats, type UserReview, type FriendProfile, type FriendRequest, type NotificationPreferences, type ScheduleSummary, type ScheduleDetail } from '../lib/api'
import { displayName, formatDate, timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'

function StatCard({ value, label, sub, color }: { value: string; label: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000)
    return () => clearTimeout(timer)
  }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
      style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600, animation: 'none' }}>
      <CheckCircle size={16} color="#10B981" />
      {message}
    </div>
  )
}

const MAJORS = ['Computer Science', 'Computer & Communications Engineering', 'Electrical & Computer Engineering', 'Civil Engineering', 'Mechanical Engineering', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Business Administration', 'Psychology', 'English', 'History']
const MINORS = ['None', 'Mathematics', 'Computer Science', 'Data Science', 'Economics', 'Business', 'Psychology', 'English', 'History']

function NotifToggle({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: (next: boolean) => void }) {
  const [enabled, setEnabled] = useState(on)
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</div>
      </div>
      <button
        onClick={() => { const next = !enabled; setEnabled(next); onToggle(next) }}
        className="rounded-full transition-all shrink-0"
        style={{ width: 40, height: 22, background: enabled ? '#4338CA' : '#E2E8F0', position: 'relative' }}
      >
        <div className="absolute top-1 rounded-full transition-all"
          style={{ width: 14, height: 14, background: 'white', left: enabled ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

export default function Profile() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<'schedules' | 'reviews' | 'settings'>('schedules')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [reviews, setReviews] = useState<UserReview[]>([])
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([])
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [scheduleDetails, setScheduleDetails] = useState<Record<number, ScheduleDetail>>({})
  const [viewSchedule, setViewSchedule] = useState<ScheduleDetail | null>(null)
  const [compareScheduleId, setCompareScheduleId] = useState<number | null>(null)
  const [compareOtherId, setCompareOtherId] = useState<number | null>(null)
  // TODO(frontend): persist preferred schedule when backend support exists.
  const [preferredScheduleId, setPreferredScheduleId] = useState<number | null>(() => {
    const stored = window.localStorage.getItem('preferredScheduleId')
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', major: '', minor: 'None', level: '' })
  const [minor, setMinor] = useState('None')
  const [accent, setAccent] = useState(() => window.localStorage.getItem('profileAccent') ?? 'Light')
  const [savingProfile, setSavingProfile] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pw, setPw] = useState({ current: '', password: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [savingPw, setSavingPw] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null)

  const userId = user?.id
  const localPart = user?.email?.split('@')[0] ?? 'ST'
  const nameInitials = profile
    ? ((profile.firstName?.[0] ?? '') + (profile.lastName?.[0] ?? '')).toUpperCase() || '?'
    : (localPart.slice(0, 2) || 'ST').toUpperCase()

  useEffect(() => {
    const savedAccents: Record<string, [string, string, string, string]> = {
      Pink: ['#EC4899', '#FDF2F8', '#F9A8D4', '#DB2777'],
      Blue: ['#0284C7', '#F0F9FF', '#BAE6FD', '#0369A1'],
      Red: ['#DC2626', '#FEF2F2', '#FECACA', '#B91C1C'],
    }
    const colors = savedAccents[accent]
    if (!colors) return
    const root = document.documentElement
    root.style.setProperty('--color-primary', colors[0])
    root.style.setProperty('--color-primary-light', colors[1])
    root.style.setProperty('--color-primary-border', colors[2])
    root.style.setProperty('--color-primary-grad', colors[3])
  }, [accent])

  useEffect(() => {
    if (!userId) {
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [p, s, r, friendsRes, requestsRes, schedulesRes, np] = await Promise.all([
          api.users.profile(userId!),
          api.users.stats(userId!),
          api.users.reviews(userId!, 1, 50),
          api.friends.list(),
          api.friends.requests(),
          api.schedules.list(1, 50),
          api.notifications.preferences(),
        ])
        if (cancelled) {
          return
        }
        setProfile(p.data)
        setStats(s.data)
        setReviews(r.data)
        setFriends(friendsRes.data)
        setIncomingRequests(requestsRes.data.incoming)
        setOutgoingRequests(requestsRes.data.outgoing)
        setSchedules(schedulesRes.data)
        const loadedDetails = await Promise.all(schedulesRes.data.map((schedule) => api.schedules.get(schedule.id)))
        if (!cancelled) setScheduleDetails(Object.fromEntries(loadedDetails.map((response) => [response.data.id, response.data])))
        setNotifPrefs(np.data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load profile.')
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
  }, [userId])

  const refreshFriendData = async () => {
    if (!userId) return
    const [friendsRes, requestsRes, statsRes] = await Promise.all([
      api.friends.list(),
      api.friends.requests(),
      api.users.stats(userId),
    ])
    setFriends(friendsRes.data)
    setIncomingRequests(requestsRes.data.incoming)
    setOutgoingRequests(requestsRes.data.outgoing)
    setStats(statsRes.data)
  }

  const acceptRequest = async (userId: string) => {
    try {
      await api.friends.acceptRequest(userId)
      await refreshFriendData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept friend request.')
    }
  }

  const rejectRequest = async (userId: string) => {
    try {
      await api.friends.rejectRequest(userId)
      await refreshFriendData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject friend request.')
    }
  }

  const cancelRequest = async (userId: string) => {
    try {
      await api.friends.remove(userId)
      await refreshFriendData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel friend request.')
    }
  }

  const startEdit = () => {
    if (!profile) {
      return
    }
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      major: profile.major ?? '',
      minor,
      level: profile.level ?? '',
    })
    setEditing(true)
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const { data } = await api.users.updateProfile({ firstName: form.firstName, lastName: form.lastName, major: form.major, level: form.level })
      setProfile(data)
      setMinor(form.minor)
      setEditing(false)
      setToast('Profile updated!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    if (pw.password.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (pw.password !== pw.confirm) {
      setPwError('Passwords do not match.')
      return
    }
    setSavingPw(true)
    setPwError(null)
    try {
      await api.users.changePassword(pw.current, pw.password, pw.confirm)
      setShowPassword(false)
      setPw({ current: '', password: '', confirm: '' })
      setToast('Password updated!')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setSavingPw(false)
    }
  }

  const deleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await api.users.deleteAccount()
      await logout()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.')
      setDeleting(false)
    }
  }

  const totalReviews = (stats?.courseReviewCount ?? 0) + (stats?.professorReviewCount ?? 0)

  const setPreferredSchedule = (id: number) => {
    setPreferredScheduleId(id)
    window.localStorage.setItem('preferredScheduleId', String(id))
  }

  const applyAppearance = async (name: string) => {
    const accents: Record<string, { primary: string; light: string; border: string; grad: string }> = {
      Pink: { primary: '#EC4899', light: '#FDF2F8', border: '#F9A8D4', grad: '#DB2777' },
      Blue: { primary: '#0284C7', light: '#F0F9FF', border: '#BAE6FD', grad: '#0369A1' },
      Red: { primary: '#DC2626', light: '#FEF2F2', border: '#FECACA', grad: '#B91C1C' },
    }
    setAccent(name)
    window.localStorage.setItem('profileAccent', name)
    if (name === 'Light' || name === 'Dark') {
      const root = document.documentElement
      root.style.removeProperty('--color-primary')
      root.style.removeProperty('--color-primary-light')
      root.style.removeProperty('--color-primary-border')
      root.style.removeProperty('--color-primary-grad')
      await api.users.updateTheme(name.toLowerCase() as 'light' | 'dark')
    } else {
      const colors = accents[name]
      if (colors) {
        const root = document.documentElement
        root.style.setProperty('--color-primary', colors.primary)
        root.style.setProperty('--color-primary-light', colors.light)
        root.style.setProperty('--color-primary-border', colors.border)
        root.style.setProperty('--color-primary-grad', colors.grad)
      }
    }
    setToast(`Theme set to ${name}.`)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Profile header */}
      <div className="px-8 pt-8 pb-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-end gap-6 mb-6">
          {/* Avatar */}
          <div className="relative">
            <div className="rounded-3xl flex items-center justify-center"
              style={{ width: 96, height: 96, background: 'linear-gradient(135deg, var(--color-primary, #4338CA) 0%, #8B5CF6 100%)', fontSize: 32, fontWeight: 800, color: 'white', border: '4px solid white', boxShadow: '0 4px 16px rgba(67,56,202,0.3)' }}>
              {nameInitials}
            </div>
            <div className="absolute -bottom-1 -right-1 rounded-full p-1.5"
              style={{ background: '#10B981', border: '2px solid white' }}>
              <CheckCircle size={12} color="white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>
                {displayName(profile?.firstName, profile?.lastName) || localPart || 'Student'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span style={{ fontSize: 14, color: '#64748B', fontWeight: 500 }}>{profile?.major ?? '—'}</span>
              <span style={{ color: '#E2E8F0' }}>·</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>{profile?.level ?? '—'}</span>
              <span style={{ color: '#E2E8F0' }}>·</span>
              <span style={{ fontSize: 14, color: '#64748B' }}>{user?.email}</span>
            </div>
          </div>

          {/* Edit button */}
          <button onClick={startEdit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors mb-4"
            style={{ fontSize: 13, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#4338CA' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B' }}>
            <Edit3 size={14} />
            Edit Profile
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
              style={{ fontSize: 13, color: activeTab === t.id ? 'var(--color-primary, #4338CA)' : '#64748B' }}>
              {t.label}
              {activeTab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'var(--color-primary, #4338CA)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {error && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
            {error}
          </div>
        )}

        {loading && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>Loading profile...</div>}

        {!loading && profile && activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard value={String(totalReviews)} label="Reviews Written" sub="Courses + professors" color="var(--color-primary, #4338CA)" />
              <StatCard value={String(stats?.courseReviewCount ?? 0)} label="Courses Rated" sub="Course reviews" color="#0EA5E9" />
              <StatCard value={String(stats?.professorReviewCount ?? 0)} label="Professors Rated" sub="Professor reviews" color="#7C3AED" />
              <StatCard value={String(stats?.scheduleCount ?? 0)} label="Schedules Saved" sub="Generated plans" color="#059669" />
              <StatCard value={String(stats?.friendCount ?? 0)} label="Friends" sub="On LogicFlow" color="#F59E0B" />
            </div>
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4"><Star size={16} color="#F59E0B" /><div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Recent Reviews</div></div>
              {reviews.length === 0 && <div style={{ fontSize: 12, color: '#94A3B8' }}>No reviews yet.</div>}
              {reviews.slice(0, 3).map((review) => <div key={review.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid #F8FAFC' }}><div className="flex">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={10} fill={index < review.rating ? '#F59E0B' : 'none'} color={index < review.rating ? '#F59E0B' : '#CBD5E1'} />)}</div><span className="truncate" style={{ fontSize: 12, color: '#64748B' }}>{review.type === 'course' ? review.course?.title ?? 'Course review' : displayName(review.professor?.firstName, review.professor?.lastName) || 'Professor review'}</span></div>)}
            </div>
          </div>
        )}

        {!loading && activeTab === 'friends' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Friends ({friends.length})</div>
            {friends.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>No friends yet. Visit the Community to find classmates.</div>}
            <div className="grid grid-cols-2 gap-3">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-2xl p-4"
                  style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="rounded-full flex items-center justify-center shrink-0"
                    style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: 14, fontWeight: 700, color: 'white' }}>
                    {((f.firstName?.[0] ?? '') + (f.lastName?.[0] ?? '')).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{displayName(f.firstName, f.lastName)}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{[f.major, f.level].filter(Boolean).join(' · ') || 'AUB Student'}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Incoming Requests ({incomingRequests.length})</div>
              {incomingRequests.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>No pending requests.</div>}
              <div className="grid grid-cols-2 gap-3">
                {incomingRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{displayName(request.user.firstName, request.user.lastName)}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{[request.user.major, request.user.level].filter(Boolean).join(' · ') || 'AUB Student'}</div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => void acceptRequest(request.user.id)} className="rounded-lg px-3 py-1.5" style={{ fontSize: 11, fontWeight: 700, background: '#4338CA', color: 'white' }}>Accept</button>
                      <button onClick={() => void rejectRequest(request.user.id)} className="rounded-lg px-3 py-1.5" style={{ fontSize: 11, fontWeight: 700, background: '#FEF2F2', color: '#DC2626' }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Sent Requests ({outgoingRequests.length})</div>
              {outgoingRequests.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>No sent requests are pending.</div>}
              <div className="grid grid-cols-2 gap-3">
                {outgoingRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{displayName(request.user.firstName, request.user.lastName)}</div>
                    <div style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>Pending</div>
                    <button onClick={() => void cancelRequest(request.user.id)} className="rounded-lg px-3 py-1.5 mt-3" style={{ fontSize: 11, fontWeight: 700, background: '#FEF2F2', color: '#DC2626' }}>Cancel request</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'schedules' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Saved Schedules ({schedules.length})</div>
            {schedules.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>No saved schedules yet.</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {schedules.map((schedule) => {
                const detail = scheduleDetails[schedule.id]
                const preferred = preferredScheduleId === schedule.id
                return <div key={schedule.id} className="rounded-2xl p-5" style={{ background: preferred ? 'var(--color-primary-light, #EEF2FF)' : '#FFFFFF', border: `1px solid ${preferred ? 'var(--color-primary-border, #C7D2FE)' : '#F1F5F9'}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                  <div className="flex items-start justify-between gap-3"><div><div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{schedule.name ?? `Schedule #${schedule.id}`}</div><div className="flex flex-wrap gap-3 mt-1" style={{ fontSize: 11, color: '#64748B' }}><span>{schedule.totalCredits} credits</span><span>{schedule.days.length ? schedule.days.map((day) => ['Mon','Tue','Wed','Thu','Fri'][day] ?? day).join(' · ') : 'No study days'}</span><span>Saved {formatDate(schedule.createdAt)}</span></div></div>{preferred && <span className="rounded-full px-2.5 py-1" style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-primary, #4338CA)', background: '#FFFFFF' }}>✓ Preferred</span>}</div>
                  {detail && <div className="flex flex-wrap gap-1.5 mt-4">{detail.courses.map((course) => <span key={`${course.courseId}-${course.section.id}`} className="rounded-full px-2.5 py-1" style={{ fontSize: 10, fontWeight: 700, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>{course.code ?? course.title ?? 'Course'}</span>)}</div>}
                  <div className="flex flex-wrap gap-2 mt-4"><button disabled={!detail} onClick={() => detail && setViewSchedule(detail)} className="rounded-lg px-3 py-1.5 font-semibold disabled:opacity-50" style={{ fontSize: 11, background: 'var(--color-primary-light, #EEF2FF)', color: 'var(--color-primary, #4338CA)', border: '1px solid var(--color-primary-border, #C7D2FE)' }}><Eye size={12} style={{ display: 'inline', marginRight: 4 }} />View</button><button disabled={schedules.length < 2} onClick={() => { setCompareScheduleId(schedule.id); setCompareOtherId(schedules.find((item) => item.id !== schedule.id)?.id ?? null) }} className="rounded-lg px-3 py-1.5 font-semibold disabled:opacity-50" style={{ fontSize: 11, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}><GitCompare size={12} style={{ display: 'inline', marginRight: 4 }} />Compare</button><button onClick={() => setPreferredSchedule(schedule.id)} className="rounded-lg px-3 py-1.5 font-semibold" style={{ fontSize: 11, background: preferred ? 'var(--color-primary, #4338CA)' : '#F8FAFC', color: preferred ? '#FFFFFF' : '#64748B', border: '1px solid var(--color-primary-border, #C7D2FE)' }}>{preferred ? '✓ Preferred' : 'Set as Preferred'}</button></div>
                </div>
              })}
            </div>
          </div>
        )}

        {!loading && activeTab === 'reviews' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>My Reviews</div>
            {reviews.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>You haven't written any reviews yet.</div>}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl p-5 mb-4"
                style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="rounded-md px-2 py-0.5" style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FF', color: '#4338CA', textTransform: 'capitalize' }}>
                      {r.type === 'course' ? 'Course' : 'Professor'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginLeft: 8 }}>
                      {r.type === 'course' ? r.course?.title ?? '—' : displayName(r.professor?.firstName, r.professor?.lastName) || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>{timeAgo(r.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={12} fill={j < r.rating ? '#F59E0B' : 'none'} color={j < r.rating ? '#F59E0B' : '#CBD5E1'} />
                    ))}
                  </div>
                </div>
                {r.comment && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{r.comment}</p>}
                {r.difficulty !== null && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="rounded-full px-2.5 py-0.5" style={{ fontSize: 10, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
                      Difficulty {r.difficulty}/5
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ---- SETTINGS TAB ---- */}
        {!loading && activeTab === 'settings' && (
          <div className="max-w-2xl flex flex-col gap-6">
            {/* Notification preferences */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Bell size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notifications</div>
              </div>
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="Friend schedule shared" sub="When a friend shares their schedule with you" on={notifPrefs?.scheduleShares ?? false} onToggle={(v) => void api.users.updateNotifications({ scheduleShares: v })} />
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="New professor reviews" sub="Reviews posted for professors you follow" on={notifPrefs?.reviewLikes ?? false} onToggle={(v) => void api.users.updateNotifications({ reviewLikes: v })} />
            </div>

            {/* Privacy */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Eye size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Privacy</div>
              </div>
              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Profile visibility</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Who can see your full profile</div>
                </div>
                <select
                  defaultValue="friends"
                  onChange={(e) => void api.users.updatePrivacy({ profileVisibility: e.target.value as 'public' | 'friends' | 'private' })}
                  className="rounded-lg px-3 py-1.5 outline-none"
                  style={{ fontSize: 12, fontWeight: 600, background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                >
                  <option value="public">Public</option>
                  <option value="friends">Friends only</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            {/* Account */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Shield size={16} color="#4338CA" />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Account & Security</div>
              </div>
              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#94A3B8' }}><Lock size={14} /></span>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Email address</div>
                    <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>{user?.email}</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: '#94A3B8' }}><Lock size={14} /></span>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>Password</div>
                    <div style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>••••••••••</div>
                  </div>
                </div>
                <button onClick={() => setShowPassword(!showPassword)}
                  className="text-xs font-semibold rounded-lg px-3 py-1.5"
                  style={{ color: '#4338CA', background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                  {showPassword ? 'Cancel' : 'Change'}
                </button>
              </div>

              {showPassword && (
                <div className="rounded-xl p-4 mt-2" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div className="flex flex-col gap-2">
                    <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Current password"
                      className="rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
                    <input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} placeholder="New password (min 8 characters)"
                      className="rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
                    <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="Confirm new password"
                      className="rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#FFFFFF' }} />
                    {pwError && <div style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>{pwError}</div>}
                    <button onClick={() => void savePassword()} disabled={savingPw}
                      className="self-start rounded-lg px-4 py-1.5 font-semibold"
                      style={{ fontSize: 12, background: '#4338CA', color: 'white' }}>
                      {savingPw ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              )}
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
                    { name: 'Light', value: 'light', color: '#F8FAFC', ring: '#CBD5E1' },
                    { name: 'Dark', value: 'dark', color: '#0F172A', ring: '#0F172A' },
                    { name: 'Pink', value: 'pink', color: '#EC4899', ring: '#F9A8D4' },
                    { name: 'Blue', value: 'blue', color: '#0284C7', ring: '#BAE6FD' },
                    { name: 'Red', value: 'red', color: '#DC2626', ring: '#FECACA' },
                  ].map((t) => (
                    <button key={t.value}
                      onClick={() => void applyAppearance(t.name)}
                      className="flex flex-col items-center gap-1.5">
                      <div className="rounded-xl" style={{ width: 40, height: 36, background: t.color, border: `3px solid ${accent === t.name ? 'var(--color-primary, #4338CA)' : t.ring}`, boxShadow: accent === t.name ? '0 0 0 2px var(--color-primary-light, #EEF2FF)' : '0 1px 3px rgba(0,0,0,0.1)' }} />
                      <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{t.name}</span>
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
                <button onClick={() => void deleteAccount()}
                  className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: confirmDelete ? '#DC2626' : '#FEF2F2', color: confirmDelete ? 'white' : '#DC2626', border: '1px solid #FECACA' }}>
                  {deleting ? 'Deleting...' : confirmDelete ? 'Click to confirm' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit profile modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(false) }}>
          <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 440, background: '#FFFFFF' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Edit Profile</div>
              <button onClick={() => setEditing(false)} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>First name</div>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Last name</div>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Major</div>
                <select value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC' }}><option value="">Select major</option>{MAJORS.map((major) => <option key={major}>{major}</option>)}</select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Minor</div>
                {/* TODO(frontend): persist minor when the current profile API supports it. */}
                <select value={form.minor} onChange={(e) => setForm({ ...form, minor: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>{MINORS.map((minorOption) => <option key={minorOption}>{minorOption}</option>)}</select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>Level</div>
                <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg" style={{ fontSize: 13, color: '#64748B' }}>Cancel</button>
              <button onClick={() => void saveProfile()} disabled={savingProfile}
                className="px-4 py-2 rounded-lg font-semibold" style={{ fontSize: 13, background: 'var(--color-primary, #4338CA)', color: 'white' }}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewSchedule && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) setViewSchedule(null) }}><div className="rounded-2xl shadow-2xl overflow-hidden" style={{ width: 720, maxWidth: '100%', maxHeight: '88vh', background: '#FFFFFF' }}><div className="flex items-center justify-between px-6 py-4" style={{ background: 'var(--color-primary-light, #EEF2FF)', borderBottom: '1px solid var(--color-primary-border, #C7D2FE)' }}><div><div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{viewSchedule.name ?? `Schedule #${viewSchedule.id}`}</div><div style={{ fontSize: 11, color: '#64748B' }}>{viewSchedule.totalCredits} credits · {viewSchedule.courseCount} courses</div></div><button onClick={() => setViewSchedule(null)}><X size={18} /></button></div><div className="p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>{viewSchedule.courses.map((course) => <div key={`${course.courseId}-${course.section.id}`} className="rounded-xl p-4 mb-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary, #4338CA)' }}>{course.code ?? 'Course'} · Section {course.section.sectionNumber}</div><div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{course.title}</div><div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{displayName(course.professor?.firstName, course.professor?.lastName) || 'Professor TBA'}{course.section.room ? ` · ${course.section.room}` : ''}</div></div>)}</div></div></div>}

      {compareScheduleId !== null && compareOtherId !== null && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) setCompareScheduleId(null) }}><div className="rounded-2xl shadow-2xl overflow-hidden" style={{ width: 820, maxWidth: '100%', maxHeight: '88vh', background: '#FFFFFF' }}><div className="flex items-center justify-between px-6 py-4" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}><div style={{ fontSize: 17, fontWeight: 800 }}>Compare Schedules</div><button onClick={() => setCompareScheduleId(null)}><X size={18} /></button></div><div className="p-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"><select value={compareScheduleId} onChange={(event) => setCompareScheduleId(Number(event.target.value))} className="rounded-xl px-3 py-2" style={{ border: '1px solid #E2E8F0' }}>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name ?? `Schedule #${schedule.id}`}</option>)}</select><select value={compareOtherId} onChange={(event) => setCompareOtherId(Number(event.target.value))} className="rounded-xl px-3 py-2" style={{ border: '1px solid #E2E8F0' }}>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name ?? `Schedule #${schedule.id}`}</option>)}</select></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[scheduleDetails[compareScheduleId], scheduleDetails[compareOtherId]].map((detail, index) => <div key={index} className="rounded-2xl p-4" style={{ background: 'var(--color-primary-light, #EEF2FF)', border: '1px solid var(--color-primary-border, #C7D2FE)' }}><div style={{ fontSize: 14, fontWeight: 800 }}>{detail?.name ?? 'Loading schedule...'}</div><div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>{detail ? `${detail.totalCredits} credits · ${detail.courseCount} courses` : ''}</div>{detail?.courses.map((course) => <div key={`${course.courseId}-${course.section.id}`} className="rounded-lg px-3 py-2 mb-1" style={{ background: '#FFFFFF', fontSize: 11, fontWeight: 700, color: '#475569' }}>{course.code ?? course.title ?? 'Course'}</div>)}</div>)}</div></div></div></div>}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
