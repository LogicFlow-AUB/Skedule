import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Send, UserPlus, Users, Calendar, TrendingUp, Star, CheckCircle } from 'lucide-react'
import { api, type Post as ApiPost, type FriendProfile } from '../lib/api'
import { displayName, formatDateTime, timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'Schedule Tips': { bg: '#EEF2FF', text: '#4338CA' },
  'Professor Reviews': { bg: '#FFF7ED', text: '#C2410C' },
  'Question': { bg: '#F0FDF4', text: '#15803D' },
  'Registration Tips': { bg: '#FEF9C3', text: '#92400E' },
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  schedule: <Calendar size={13} />,
  review: <Star size={13} />,
  question: <MessageCircle size={13} />,
  tip: <TrendingUp size={13} />,
}

const TYPE_COLORS: Record<string, string> = {
  schedule: '#4338CA',
  review: '#F59E0B',
  question: '#059669',
  tip: '#D97706',
}

const AVATAR_COLORS = ['#4338CA', '#059669', '#7C3AED', '#D97706', '#0EA5E9', '#EC4899', '#6366F1', '#DC2626']

const STATUS_COLORS: Record<string, string> = { online: '#10B981', away: '#F59E0B', offline: '#CBD5E1' }

const DAY_COLORS: Record<string, string> = { Mon: '#4338CA', Tue: '#059669', Wed: '#0EA5E9', Thu: '#7C3AED', Fri: '#10B981' }

function initialsOf(firstName?: string | null, lastName?: string | null): string {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

function PostCard({ post, currentUserInitials, onCommented }: { post: ApiPost; currentUserInitials: string; onCommented: (postId: number, content: string) => void }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const toggleLike = async () => {
    const next = !liked
    setLiked(next)
    setLikeCount((p) => p + (next ? 1 : -1))
    try {
      if (next) {
        await api.feed.like(post.id)
      } else {
        await api.feed.unlike(post.id)
      }
    } catch {
      setLiked(!next)
      setLikeCount((p) => p + (next ? -1 : 1))
    }
  }

  const toggleSave = async () => {
    const next = !saved
    setSaved(next)
    try {
      if (next) {
        await api.feed.save(post.id)
      } else {
        await api.feed.unsave(post.id)
      }
    } catch {
      setSaved(!next)
    }
  }

  const submitComment = async () => {
    const text = comment.trim()
    if (!text || postingComment) {
      return
    }
    setPostingComment(true)
    try {
      await api.feed.createComment(post.id, text)
      setComment('')
      setCommentCount((p) => p + 1)
      onCommented(post.id, text)
    } catch {
      // best-effort
    } finally {
      setPostingComment(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="rounded-full flex items-center justify-center shrink-0 font-bold"
          style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', color: 'white', fontSize: 14 }}>
          {initialsOf(post.author?.firstName, post.author?.lastName) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{displayName(post.author?.firstName, post.author?.lastName)}</span>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {[post.author?.major, post.author?.level].filter(Boolean).join(' · ') || 'AUB Student'} · {timeAgo(post.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-full px-2 py-1"
            style={{ background: TYPE_COLORS[post.type] + '15', color: TYPE_COLORS[post.type] }}>
            {TYPE_ICONS[post.type]}
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'capitalize' }}>{post.type}</span>
          </div>
          <button style={{ color: '#94A3B8' }} className="p-1 rounded-lg hover:bg-slate-50">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{post.content}</p>
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-3 flex-wrap">
          {post.tags.map((t) => {
            const tc = TAG_COLORS[t] ?? { bg: '#F1F5F9', text: '#64748B' }
            return (
              <span key={t} className="rounded-full px-2.5 py-0.5 cursor-pointer transition-colors"
                style={{ fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.text }}>
                #{t.replace(/\s/g, '')}
              </span>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 py-3" style={{ borderTop: '1px solid #F8FAFC' }}>
        <button onClick={() => void toggleLike()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
          style={{ color: liked ? '#EF4444' : '#64748B', background: liked ? '#FEF2F2' : 'transparent', fontSize: 12, fontWeight: liked ? 700 : 500 }}>
          <Heart size={14} fill={liked ? '#EF4444' : 'none'} /> {likeCount}
        </button>
        <button onClick={() => setShowComment(!showComment)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#64748B', fontSize: 12 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
          <MessageCircle size={14} /> {commentCount}
        </button>
        <button onClick={() => void toggleSave()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg ml-auto transition-all"
          style={{ color: saved ? '#4338CA' : '#64748B', background: saved ? '#EEF2FF' : 'transparent' }}>
          <Bookmark size={14} fill={saved ? '#4338CA' : 'none'} />
        </button>
      </div>

      {/* Comment input */}
      {showComment && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <div className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: 10, fontWeight: 700, color: 'white' }}>
            {currentUserInitials}
          </div>
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <input value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitComment() }}
              placeholder="Write a comment..."
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 12, color: '#374151' }} />
            <button onClick={() => void submitComment()} style={{ color: comment ? '#4338CA' : '#CBD5E1' }} disabled={postingComment}>
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Community() {
  const { user } = useAuth()
  const [activeCompose, setActiveCompose] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [composeType, setComposeType] = useState<'schedule' | 'tip' | 'review' | 'question'>('schedule')
  const [posting, setPosting] = useState(false)
  const [posts, setPosts] = useState<ApiPost[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [suggested, setSuggested] = useState<FriendProfile[]>([])
  const [events, setEvents] = useState<{ title: string; date: string; type: string; urgent: boolean }[]>([])
  const [freeTime, setFreeTime] = useState<{ day: string; color: string; pct: number }[]>([])
  const [trendingCourses, setTrendingCourses] = useState<{ code: string; name: string; trend: string; color: string }[]>([])
  const [trendingProfs, setTrendingProfs] = useState<{ name: string; department: string; rating: string }[]>([])
  const [joinedGroups, setJoinedGroups] = useState<Set<string>>(new Set())
  const [groupModal, setGroupModal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // TODO(backend): study groups have no API endpoint yet (Phase 11) — kept as local UI placeholder.
  const STUDY_GROUPS = [
    { name: 'EECE 330 — HW 5', members: 8, time: 'Tonight 8 PM', location: 'Library Room 204', host: 'Sarah K.' },
    { name: 'MATH 201 — Finals', members: 12, time: 'Sat 2 PM', location: 'AUB Science Hall', host: 'Karim A.' },
  ]

  const localPart = user?.email ? user.email.split('@')[0] ?? 'ST' : 'ST'
  const currentUserInitials = (localPart.slice(0, 2) || 'ST').toUpperCase()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [feedRes, friendsRes, suggestedRes, eventsRes, freeTimeRes, coursesRes, profsRes] = await Promise.all([
          api.feed.list(1, 20),
          api.friends.list(),
          api.friends.suggested(10),
          api.dashboard.upcoming(),
          api.friends.commonFreeTime(),
          api.courses.list({ sort: 'popularity', order: 'desc', limit: 3 }),
          api.professors.list({ sort: 'rating', order: 'desc', limit: 2 }),
        ])

        if (cancelled) {
          return
        }

        setPosts(feedRes.data)
        setFriends(friendsRes.data)
        setSuggested(suggestedRes.data)
        setEvents(eventsRes.data.map((e) => ({
          title: e.title,
          date: formatDateTime(e.starts_at),
          type: e.type ?? '',
          urgent: e.type === 'registration',
        })))
        setFreeTime(freeTimeRes.data.days.map((d) => ({
          day: d.label,
          color: DAY_COLORS[d.label] ?? '#4338CA',
          pct: d.freePercentage,
        })))
        setTrendingCourses(coursesRes.data.map((c) => ({
          code: c.code,
          name: c.title,
          trend: `${c.reviewCount} reviews`,
          color: '#4338CA',
        })))
        setTrendingProfs(profsRes.data.map((p) => ({
          name: displayName(p.firstName, p.lastName),
          department: p.department ?? '—',
          rating: p.averageRating === null ? '—' : p.averageRating.toFixed(1),
        })))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load community data.')
        }
      } finally {
        if (!cancelled) {
          setFeedLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const onlineCount = friends.filter((f) => f.presenceStatus === 'online').length
  const onlineFriends = friends.filter((f) => f.presenceStatus === 'online')
  const otherFriends = friends.filter((f) => f.presenceStatus !== 'online')

  const handleJoinGroup = (name: string) => {
    setJoinedGroups((prev) => {
      const next = new Set(prev)
      next.add(name)
      return next
    })
    setGroupModal(name)
    setTimeout(() => setGroupModal(null), 3000)
  }

  async function sendRequest(userId: string) {
    try {
      await api.friends.sendRequest(userId)
      setSuggested((prev) => prev.filter((s) => s.id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send friend request.')
    }
  }

  async function submitPost() {
    const content = composeText.trim()
    if (!content || posting) {
      return
    }
    setPosting(true)
    try {
      const { data: created } = await api.feed.create({ type: composeType, content })
      setPosts((prev) => [created, ...prev])
      setComposeText('')
      setActiveCompose(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share post.')
    } finally {
      setPosting(false)
    }
  }

  const friendColor = (id: string, index: number) => {
    const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return AVATAR_COLORS[(index + hash) % AVATAR_COLORS.length]
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Left: Friends list */}
      <aside className="flex flex-col shrink-0 h-full overflow-y-auto"
        style={{ width: 220, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Friends</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{onlineCount} online now</div>
        </div>

        <div className="px-3 py-3 flex-1">
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>
            Online — {onlineCount}
          </div>
          {onlineFriends.map((f, i) => (
            <button key={f.id} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              style={{ textAlign: 'left' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <div className="relative shrink-0">
                <div className="rounded-full flex items-center justify-center"
                  style={{ width: 32, height: 32, background: friendColor(f.id, i) + '20', color: friendColor(f.id, i), fontSize: 11, fontWeight: 700 }}>
                  {initialsOf(f.firstName, f.lastName) || '?'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
                  style={{ width: 10, height: 10, background: STATUS_COLORS[f.presenceStatus] ?? '#CBD5E1' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(f.firstName, f.lastName)}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{[f.major, f.level].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </button>
          ))}
          {onlineFriends.length === 0 && !feedLoading && (
            <div style={{ fontSize: 11, color: '#94A3B8', paddingLeft: 4 }}>No friends online.</div>
          )}

          {otherFriends.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4, marginTop: 12 }}>
                Away / Offline
              </div>
              {otherFriends.map((f, i) => (
                <button key={f.id} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
                  style={{ textAlign: 'left', opacity: 0.6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.6' }}>
                  <div className="relative shrink-0">
                    <div className="rounded-full flex items-center justify-center"
                      style={{ width: 32, height: 32, background: friendColor(f.id, i) + '20', color: friendColor(f.id, i), fontSize: 11, fontWeight: 700 }}>
                      {initialsOf(f.firstName, f.lastName) || '?'}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
                      style={{ width: 10, height: 10, background: STATUS_COLORS[f.presenceStatus] ?? '#CBD5E1' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(f.firstName, f.lastName)}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{[f.major, f.level].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4, marginTop: 12 }}>
            Suggested
          </div>
          {suggested.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: '#F8FAFC', marginBottom: 4 }}>
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, background: friendColor(s.id, i) + '20', color: friendColor(s.id, i), fontSize: 11, fontWeight: 700 }}>
                {initialsOf(s.firstName, s.lastName) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{displayName(s.firstName, s.lastName)}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{[s.major, s.level].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <button onClick={() => void sendRequest(s.id)} style={{ color: '#4338CA' }}>
                <UserPlus size={14} />
              </button>
            </div>
          ))}
          {suggested.length === 0 && !feedLoading && (
            <div style={{ fontSize: 11, color: '#94A3B8', paddingLeft: 4 }}>No suggestions right now.</div>
          )}
        </div>
      </aside>

      {/* Center: Feed */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
          {error && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>
              {error}
            </div>
          )}

          {/* Compose */}
          <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: 12, fontWeight: 700, color: 'white' }}>
                {currentUserInitials}
              </div>
              <button
                onClick={() => setActiveCompose(true)}
                className="flex-1 rounded-xl px-4 py-2.5 text-left transition-colors"
                style={{ fontSize: 13, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid #C7D2FE' }}
                onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid #E2E8F0' }}>
                Share a schedule, tip, or question...
              </button>
            </div>
            {activeCompose && (
              <div>
                <textarea
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder="What's on your mind? Share a schedule tip, course review, or question..."
                  className="w-full rounded-xl p-3 outline-none resize-none"
                  rows={3}
                  style={{ fontSize: 13, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#374151' }}
                  autoFocus
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-1.5">
                    {(['schedule', 'tip', 'review', 'question'] as const).map((type) => (
                      <button key={type} onClick={() => setComposeType(type)}
                        className="rounded-full px-2.5 py-1"
                        style={{
                          fontSize: 11, fontWeight: 600,
                          background: composeType === type ? '#EEF2FF' : '#F1F5F9',
                          color: composeType === type ? '#4338CA' : '#64748B',
                          textTransform: 'capitalize',
                        }}>
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveCompose(false)}
                      className="px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: '#64748B' }}>Cancel</button>
                    <button
                      onClick={() => void submitPost()}
                      disabled={!composeText.trim() || posting}
                      className="px-4 py-1.5 rounded-lg font-semibold"
                      style={{ fontSize: 12, background: composeText.trim() ? '#4338CA' : '#E2E8F0', color: composeText.trim() ? 'white' : '#94A3B8' }}>
                      {posting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Posts */}
          {feedLoading && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>Loading feed...</div>}
          {!feedLoading && posts.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>No posts yet. Share something!</div>}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserInitials={currentUserInitials}
              onCommented={(postId, content) => {
                // Keep feed data fresh when a comment is added.
                void api.feed.comments(postId, 1, 1).catch(() => { void content })
              }}
            />
          ))}
        </div>
      </main>

      {/* Right: Sidebar */}
      <aside className="flex flex-col shrink-0 h-full overflow-y-auto"
        style={{ width: 240, borderLeft: '1px solid #F1F5F9', background: '#FFFFFF' }}>
        {/* Events */}
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Upcoming Events</div>
          {events.length === 0 && !feedLoading && <div style={{ fontSize: 11, color: '#94A3B8' }}>No upcoming events.</div>}
          {events.map((e, i) => (
            <div key={i} className="flex items-start gap-2.5 mb-3 last:mb-0">
              <div className="rounded-lg p-1.5 mt-0.5 shrink-0"
                style={{ background: e.urgent ? '#FEF2F2' : '#F0F9FF', color: e.urgent ? '#EF4444' : '#0284C7' }}>
                {e.type === 'registration' ? <CheckCircle size={12} /> : <Users size={12} />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{e.date}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Study groups */}
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Study Groups</div>
          {STUDY_GROUPS.map((g, i) => {
            const joined = joinedGroups.has(g.name)
            return (
              <div key={i} className="rounded-xl p-3 mb-2 last:mb-0 transition-all"
                style={{ background: joined ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${joined ? '#BBF7D0' : '#F1F5F9'}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{g.name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{g.location} · Hosted by {g.host}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{joined ? g.members + 1 : g.members} members · {g.time}</div>
                  <button
                    onClick={() => { if (!joined) handleJoinGroup(g.name) }}
                    className="rounded-full px-2.5 py-0.5 transition-all"
                    style={{
                      fontSize: 10, fontWeight: 700,
                      background: joined ? '#DCFCE7' : '#EEF2FF',
                      color: joined ? '#15803D' : '#4338CA',
                      cursor: joined ? 'default' : 'pointer',
                    }}>
                    {joined ? '✓ Joined' : 'Join Group'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Common free time */}
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Common Free Time</div>
          <div className="flex flex-col gap-1.5">
            {freeTime.map((d) => (
              <div key={d.day} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#64748B', width: 28, fontWeight: 600 }}>{d.day}</span>
                <div className="flex-1 rounded-full h-2" style={{ background: '#F1F5F9' }}>
                  <div className="h-2 rounded-full" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span style={{ fontSize: 10, color: '#94A3B8', width: 24, textAlign: 'right' }}>{d.pct}%</span>
              </div>
            ))}
            {freeTime.length === 0 && !feedLoading && <div style={{ fontSize: 11, color: '#94A3B8' }}>No data yet.</div>}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>% of friends free</div>
        </div>

        {/* Trending */}
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Trending Courses</div>
          {trendingCourses.map((c) => (
            <div key={c.code} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
              <div className="rounded-lg px-1.5 py-0.5"
                style={{ background: c.color + '20', color: c.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {c.code}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>{c.trend}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trending profs */}
        <div className="p-4">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Top Professors</div>
          {trendingProfs.map((p) => (
            <div key={p.name} className="flex items-center gap-2.5 mb-3 last:mb-0">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 100%)', fontSize: 11, fontWeight: 700, color: 'white' }}>
                {initialsOf(p.name.split(' ')[0], p.name.split(' ')[1]) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{p.department}</div>
              </div>
              <div className="flex items-center gap-0.5">
                <Star size={11} fill="#F59E0B" color="#F59E0B" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B' }}>{p.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Join confirmation toast */}
      {groupModal && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl"
          style={{ background: '#1E293B', color: 'white', fontSize: 13, fontWeight: 600 }}>
          <CheckCircle size={16} color="#10B981" />
          Joined "{groupModal}" — you'll receive updates in your messages.
        </div>
      )}
    </div>
  )
}
