import { useEffect, useState } from 'react'
import {
  Star, BookOpen, Edit3, Heart, MessageSquare, Bookmark, Trophy, Target,
  GraduationCap, Bell, Lock, Eye, Palette, Shield, ChevronRight, X, CheckCircle, Users,
} from 'lucide-react'
import { api, type UserProfile, type UserStats, type UserReview, type ScheduleSummary, type NotificationPreferences } from '../lib/api'
import { displayName, formatDate, timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function formatDays(days: number[]): string {
  if (days.length === 0) {
    return '—'
  }
  return days.map((d) => DAYS[d] ?? `Day ${d}`).join(' · ')
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

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  setTimeout(onDone, 3000)
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
      style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600, animation: 'none' }}>
      <CheckCircle size={16} color="#10B981" />
      {message}
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState<'overview' | 'schedules' | 'courses' | 'reviews' | 'settings'>('overview')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([])
  const [reviews, setReviews] = useState<UserReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', major: '', level: '' })
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
    if (!userId) {
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [p, s, r, sched, np] = await Promise.all([
          api.users.profile(userId),
          api.users.stats(userId),
          api.users.reviews(userId, 1, 50),
          api.schedules.list(1, 50),
          api.notifications.preferences(),
        ])
        if (cancelled) {
          return
        }
        setProfile(p.data)
        setStats(s.data)
        setReviews(r.data)
        setSchedules(sched.data)
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

  const startEdit = () => {
    if (!profile) {
      return
    }
    setForm({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      major: profile.major ?? '',
      level: profile.level ?? '',
    })
    setEditing(true)
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const { data } = await api.users.updateProfile(form)
      setProfile(data)
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

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
      {/* Profile header */}
      <div className="px-8 pt-8 pb-0" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-end gap-6 mb-6">
          {/* Avatar */}
          <div className="relative">
            <div className="rounded-3xl flex items-center justify-center"
              style={{ width: 96, height: 96, background: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 100%)', fontSize: 32, fontWeight: 800, color: 'white', border: '4px solid white', boxShadow: '0 4px 16px rgba(67,56,202,0.3)' }}>
              {nameInitials}
            </div>
            <div className="absolute -bottom-1 -right-1 rounded-full p-1.5"
              style={{ background: '#10B981', border: '2px solid white' }}>
              <GraduationCap size={12} color="white" />
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
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                <MessageSquare size={12} color="#4338CA" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{totalReviews} reviews</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <BookOpen size={12} color="#16A34A" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>{stats?.scheduleCount ?? 0} schedules</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Users size={12} color="#64748B" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{stats?.friendCount ?? 0} friends</span>
              </div>
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
        {error && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
            {error}
          </div>
        )}

        {loading && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>Loading profile...</div>}

        {!loading && profile && activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-5 gap-4">
              <StatCard value={String(totalReviews)} label="Reviews Written" sub="Courses + professors" color="#4338CA" />
              <StatCard value={String(stats?.courseReviewCount ?? 0)} label="Courses Rated" sub="Course reviews" color="#0EA5E9" />
              <StatCard value={String(stats?.professorReviewCount ?? 0)} label="Professors Rated" sub="Professor reviews" color="#7C3AED" />
              <StatCard value={String(stats?.scheduleCount ?? 0)} label="Schedules Saved" sub="Generated plans" color="#059669" />
              <StatCard value={String(stats?.friendCount ?? 0)} label="Friends" sub="On LogicFlow" color="#F59E0B" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Achievements */}
              <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy size={16} color="#F59E0B" />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Achievements</div>
                </div>
                {/* TODO(backend): /users/:id/achievements returns an empty stub for now. */}
                <div className="rounded-xl p-4 text-center" style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0' }}>
                  <span style={{ fontSize: 24, marginBottom: 4, display: 'block' }}>🏆</span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>No achievements unlocked yet</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Write reviews and save schedules to earn them.</div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Favorite professors */}
                <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Heart size={16} color="#EF4444" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Favorite Professors</div>
                  </div>
                  {/* TODO(backend): /users/:id/favorite-professors returns an empty stub for now. */}
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>No favorite professors yet.</div>
                </div>

                {/* Wishlist */}
                <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={16} color="#4338CA" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Course Wishlist</div>
                  </div>
                  {/* TODO(backend): /users/:id/wishlist returns an empty stub for now. */}
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>Your wishlist is empty.</div>
                </div>
              </div>
            </div>

            {/* Community stats */}
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Community Activity</div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: <MessageSquare size={16} />, value: String(stats?.courseReviewCount ?? 0), label: 'Course Reviews', color: '#4338CA' },
                  { icon: <Star size={16} />, value: String(stats?.professorReviewCount ?? 0), label: 'Professor Reviews', color: '#F59E0B' },
                  { icon: <BookOpen size={16} />, value: String(stats?.scheduleCount ?? 0), label: 'Schedules', color: '#059669' },
                  { icon: <Users size={16} />, value: String(stats?.friendCount ?? 0), label: 'Friends', color: '#0EA5E9' },
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

        {!loading && activeTab === 'schedules' && (
          <div className="flex flex-col gap-4">
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Saved Schedules</div>
            {schedules.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8' }}>No saved schedules yet. Build one in the AI Scheduler.</div>}
            {schedules.map((s) => (
              <div key={s.id} className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{s.name ?? `Schedule #${s.id}`}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>
                      Saved {formatDate(s.createdAt)} · {formatDays(s.days)} · {s.totalCredits} credits · {s.courseCount} courses
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'courses' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>Completed Courses</div>
            {/* TODO(backend): /users/:id/completed-courses returns an empty stub for now. */}
            <div className="rounded-2xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px dashed #E2E8F0' }}>
              <GraduationCap size={32} color="#CBD5E1" />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginTop: 8 }}>No completed courses tracked yet</div>
              <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>Completed-course history isn't available in the API yet.</div>
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
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="Registration reminders" sub="Alert when registration opens for your courses" on={notifPrefs?.registrationReminders ?? false} onToggle={(v) => void api.users.updateNotifications({ registrationReminders: v })} />
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="Friend schedule shared" sub="When a friend shares their schedule with you" on={notifPrefs?.scheduleShares ?? false} onToggle={(v) => void api.users.updateNotifications({ scheduleShares: v })} />
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="New professor reviews" sub="Reviews posted for professors you follow" on={notifPrefs?.reviewLikes ?? false} onToggle={(v) => void api.users.updateNotifications({ reviewLikes: v })} />
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="Community mentions" sub="When someone mentions you in a post" on={notifPrefs?.postComments ?? false} onToggle={(v) => void api.users.updateNotifications({ postComments: v })} />
              <NotifToggle key={notifPrefs ? 'loaded' : 'loading'} label="Study group updates" sub="Activity in groups you have joined" on={notifPrefs?.friendRequests ?? false} onToggle={(v) => void api.users.updateNotifications({ friendRequests: v })} />
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
              <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Schedule sharing</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Show your current schedule to friends</div>
                </div>
                <NotifToggle label="" sub="" on={false} onToggle={(v) => void api.users.updatePrivacy({ showSchedule: v })} />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Online status</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Let friends see when you're online</div>
                </div>
                <NotifToggle label="" sub="" on={true} onToggle={(v) => void api.users.updatePrivacy({ showOnlineStatus: v })} />
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
                    { name: 'System', value: 'system', color: 'linear-gradient(135deg, #F8FAFC 50%, #0F172A 50%)', ring: '#64748B' },
                  ].map((t) => (
                    <button key={t.value}
                      onClick={() => void api.users.updateTheme(t.value as 'light' | 'dark' | 'system').then(() => setToast(`Theme set to ${t.name}.`))}
                      className="flex flex-col items-center gap-1.5">
                      <div className="rounded-xl" style={{ width: 40, height: 36, background: t.color, border: `3px solid ${t.ring}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
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
                <input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 outline-none" style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
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
                className="px-4 py-2 rounded-lg font-semibold" style={{ fontSize: 13, background: '#4338CA', color: 'white' }}>
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
