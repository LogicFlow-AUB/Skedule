import { useState } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Send, UserPlus, Users, Calendar, TrendingUp, Star, CheckCircle, Clock } from 'lucide-react'

interface Post {
  id: string
  author: string
  major: string
  year: string
  semester: string
  avatar: string
  badges: { label: string; color: string }[]
  time: string
  content: string
  tags: string[]
  likes: number
  comments: number
  shares: number
  liked: boolean
  saved: boolean
  type: 'schedule' | 'review' | 'question' | 'tip'
  schedulePreview?: { days: string; courses: string[] }
}

const POSTS: Post[] = [
  {
    id: '1',
    author: 'Sarah K.',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Fall 2025',
    avatar: 'SK',
    badges: [{ label: 'Top Contributor', color: '#F59E0B' }, { label: 'CS Student', color: '#4338CA' }],
    time: '2h ago',
    content: "Just finalized my Fall 2025 schedule! Managed to get all EECE courses with top-rated professors and keep Fridays free 🎉 Pro tip: use the AI Scheduler and set priority to 'Highest rated professors' — it worked perfectly for me.",
    tags: ['Schedule Tips', 'EECE', 'Fall 2025'],
    likes: 47,
    comments: 12,
    shares: 8,
    liked: false,
    saved: false,
    type: 'schedule',
    schedulePreview: { days: 'Mon-Thu', courses: ['EECE 330', 'EECE 351', 'MATH 201', 'PHYS 211'] },
  },
  {
    id: '2',
    author: 'Omar K.',
    major: 'Electrical Engineering',
    year: 'Senior',
    semester: 'Fall 2025',
    avatar: 'OK',
    badges: [{ label: 'Senior', color: '#7C3AED' }, { label: 'Honor Student', color: '#059669' }],
    time: '5h ago',
    content: 'Just finished Dr. Nassif\'s PHYS 211 — absolute legend of a professor. Gave us a study guide for the final and curved the midterm by 15 points. 100% recommend, rating him 5/5 without hesitation. Also great for students who learn better visually.',
    tags: ['Professor Reviews', 'PHYS 211', 'Nassif'],
    likes: 89,
    comments: 24,
    shares: 15,
    liked: true,
    saved: false,
    type: 'review',
  },
  {
    id: '3',
    author: 'Jana R.',
    major: 'Mathematics',
    year: 'Sophomore',
    semester: 'Fall 2025',
    avatar: 'JR',
    badges: [{ label: 'Helpful Reviewer', color: '#0EA5E9' }],
    time: '1d ago',
    content: "Does anyone know if ENGL 210 with Dr. Saad counts as a Writing attribute? I need one more writing course and I've heard great things but can't find confirmation in the course catalog. Also is it hard to get into?",
    tags: ['Question', 'ENGL 210', 'Attributes'],
    likes: 13,
    comments: 7,
    shares: 0,
    liked: false,
    saved: true,
    type: 'question',
  },
  {
    id: '4',
    author: 'Karim A.',
    major: 'Computer Science',
    year: 'Junior',
    semester: 'Fall 2025',
    avatar: 'KA',
    badges: [{ label: 'CS Student', color: '#4338CA' }, { label: 'Top Contributor', color: '#F59E0B' }],
    time: '2d ago',
    content: 'Registration tip for CS majors: EECE 330 fills up in the first 10 minutes. Have the section number and CRN ready before registration opens. Also, Section 01 with Dr. Hassan is the best — worth waking up early for.',
    tags: ['Registration Tips', 'EECE 330', 'CS Majors'],
    likes: 134,
    comments: 41,
    shares: 67,
    liked: true,
    saved: true,
    type: 'tip',
  },
]

const FRIENDS = [
  { name: 'Sarah K.', major: 'CS', year: 'Junior', status: 'online', sharedCourses: 2, avatar: 'SK', avatarColor: '#4338CA' },
  { name: 'Karim A.', major: 'CS', year: 'Junior', status: 'online', sharedCourses: 3, avatar: 'KA', avatarColor: '#059669' },
  { name: 'Lara M.', major: 'EECE', year: 'Senior', status: 'away', sharedCourses: 1, avatar: 'LM', avatarColor: '#7C3AED' },
  { name: 'Nour H.', major: 'Math', year: 'Sophomore', status: 'offline', sharedCourses: 2, avatar: 'NH', avatarColor: '#D97706' },
  { name: 'Ziad T.', major: 'Physics', year: 'Junior', status: 'online', sharedCourses: 1, avatar: 'ZT', avatarColor: '#0EA5E9' },
]

const SUGGESTED = [
  { name: 'Dina F.', major: 'CS', year: 'Junior', mutual: 5, avatar: 'DF', avatarColor: '#EC4899' },
  { name: 'Rami S.', major: 'EECE', year: 'Sophomore', mutual: 3, avatar: 'RS', avatarColor: '#6366F1' },
]

const EVENTS = [
  { title: 'Course Registration Opens', date: 'Nov 3, 9:00 AM', type: 'registration', urgent: true },
  { title: 'CS Study Group — Finals', date: 'Nov 10, 3:00 PM', type: 'study' },
  { title: 'EECE 330 Exam Prep', date: 'Nov 7, 5:00 PM', type: 'study' },
]

const TRENDING_COURSES = [
  { code: 'EECE 330', name: 'Digital Systems', trend: '+23% interest', color: '#4338CA' },
  { code: 'CS 201', name: 'Data Structures', trend: '+18% interest', color: '#059669' },
  { code: 'MATH 201', name: 'Calculus III', trend: '+12% interest', color: '#0EA5E9' },
]

const TRENDING_PROFS = [
  { name: 'Dr. Nassif', rating: 4.9, department: 'Physics', trend: '96% recommend' },
  { name: 'Dr. Hassan', rating: 4.8, department: 'EECE', trend: '94% recommend' },
]

const STATUS_COLORS: Record<string, string> = { online: '#10B981', away: '#F59E0B', offline: '#CBD5E1' }

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

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(post.liked)
  const [saved, setSaved] = useState(post.saved)
  const [likeCount, setLikeCount] = useState(post.likes)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')

  const toggleLike = () => {
    setLiked(!liked)
    setLikeCount((p) => p + (liked ? -1 : 1))
  }

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="rounded-full flex items-center justify-center shrink-0 font-bold"
          style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${post.badges[0]?.color ?? '#4338CA'} 0%, ${post.badges[0]?.color ?? '#6366F1'}BB 100%)`, color: 'white', fontSize: 14 }}>
          {post.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{post.author}</span>
            {post.badges.map((b) => (
              <span key={b.label} className="rounded-full px-2 py-0.5"
                style={{ fontSize: 10, fontWeight: 700, background: b.color + '20', color: b.color, border: `1px solid ${b.color}40` }}>
                {b.label}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{post.major} · {post.year} · {post.semester} · {post.time}</div>
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

      {/* Schedule preview */}
      {post.schedulePreview && (
        <div className="mx-4 mb-3 rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #E0E7FF' }}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={12} color="#4338CA" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4338CA' }}>Schedule Preview · {post.schedulePreview.days}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {post.schedulePreview.courses.map((c) => (
              <span key={c} className="rounded-lg px-2 py-1"
                style={{ fontSize: 11, fontWeight: 700, background: '#EEF2FF', color: '#4338CA' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="flex gap-1.5 px-4 pb-3 flex-wrap">
        {post.tags.map((t) => {
          const tc = TAG_COLORS[t] ?? { bg: '#F1F5F9', text: '#64748B' }
          return (
            <span key={t} className="rounded-full px-2.5 py-0.5 cursor-pointer transition-colors"
              style={{ fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.text }}>
              #{t.replace(' ', '')}
            </span>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 py-3" style={{ borderTop: '1px solid #F8FAFC' }}>
        <button onClick={toggleLike}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
          style={{ color: liked ? '#EF4444' : '#64748B', background: liked ? '#FEF2F2' : 'transparent', fontSize: 12, fontWeight: liked ? 700 : 500 }}>
          <Heart size={14} fill={liked ? '#EF4444' : 'none'} /> {likeCount}
        </button>
        <button onClick={() => setShowComment(!showComment)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#64748B', fontSize: 12 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
          <MessageCircle size={14} /> {post.comments}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#64748B', fontSize: 12 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
          <Share2 size={14} /> {post.shares}
        </button>
        <button onClick={() => setSaved(!saved)}
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
            AH
          </div>
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <input value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 outline-none bg-transparent"
              style={{ fontSize: 12, color: '#374151' }} />
            <button style={{ color: comment ? '#4338CA' : '#CBD5E1' }}>
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Community() {
  const [activeCompose, setActiveCompose] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [joinedGroups, setJoinedGroups] = useState<Set<string>>(new Set())
  const [groupModal, setGroupModal] = useState<string | null>(null)
  const posts = POSTS

  const STUDY_GROUPS = [
    { name: 'EECE 330 — HW 5', members: 8, time: 'Tonight 8 PM', location: 'Library Room 204', host: 'Sarah K.' },
    { name: 'MATH 201 — Finals', members: 12, time: 'Sat 2 PM', location: 'AUB Science Hall', host: 'Karim A.' },
  ]

  const handleJoinGroup = (name: string) => {
    setJoinedGroups((prev) => {
      const next = new Set(prev)
      next.add(name)
      return next
    })
    setGroupModal(name)
    setTimeout(() => setGroupModal(null), 3000)
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Left: Friends list */}
      <aside className="flex flex-col shrink-0 h-full overflow-y-auto"
        style={{ width: 220, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Friends</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>3 online now</div>
        </div>

        <div className="px-3 py-3 flex-1">
          {/* Online */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>
            Online — 3
          </div>
          {FRIENDS.filter((f) => f.status === 'online').map((f) => (
            <button key={f.name} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              style={{ textAlign: 'left' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <div className="relative shrink-0">
                <div className="rounded-full flex items-center justify-center"
                  style={{ width: 32, height: 32, background: f.avatarColor + '20', color: f.avatarColor, fontSize: 11, fontWeight: 700 }}>
                  {f.avatar}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
                  style={{ width: 10, height: 10, background: STATUS_COLORS[f.status] }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.major} · {f.sharedCourses} shared</div>
              </div>
            </button>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4, marginTop: 12 }}>
            Away / Offline
          </div>
          {FRIENDS.filter((f) => f.status !== 'online').map((f) => (
            <button key={f.name} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              style={{ textAlign: 'left', opacity: 0.6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.6' }}>
              <div className="relative shrink-0">
                <div className="rounded-full flex items-center justify-center"
                  style={{ width: 32, height: 32, background: f.avatarColor + '20', color: f.avatarColor, fontSize: 11, fontWeight: 700 }}>
                  {f.avatar}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white"
                  style={{ width: 10, height: 10, background: STATUS_COLORS[f.status] }} />
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.major} · {f.sharedCourses} shared</div>
              </div>
            </button>
          ))}

          {/* Pending */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4, marginTop: 12 }}>
            Suggested
          </div>
          {SUGGESTED.map((s) => (
            <div key={s.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{ background: '#F8FAFC', marginBottom: 4 }}>
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, background: s.avatarColor + '20', color: s.avatarColor, fontSize: 11, fontWeight: 700 }}>
                {s.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{s.mutual} mutual friends</div>
              </div>
              <button style={{ color: '#4338CA' }}>
                <UserPlus size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Center: Feed */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
          {/* Compose */}
          <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', fontSize: 12, fontWeight: 700, color: 'white' }}>
                AH
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
                    {['Schedule', 'Tip', 'Review', 'Question'].map((type) => (
                      <button key={type} className="rounded-full px-2.5 py-1"
                        style={{ fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveCompose(false)}
                      className="px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: '#64748B' }}>Cancel</button>
                    <button
                      className="px-4 py-1.5 rounded-lg font-semibold"
                      style={{ fontSize: 12, background: composeText ? '#4338CA' : '#E2E8F0', color: composeText ? 'white' : '#94A3B8' }}>
                      Post
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Posts */}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </main>

      {/* Right: Sidebar */}
      <aside className="flex flex-col shrink-0 h-full overflow-y-auto"
        style={{ width: 240, borderLeft: '1px solid #F1F5F9', background: '#FFFFFF' }}>
        {/* Events */}
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Upcoming Events</div>
          {EVENTS.map((e, i) => (
            <div key={i} className="flex items-start gap-2.5 mb-3 last:mb-0">
              <div className="rounded-lg p-1.5 mt-0.5 shrink-0"
                style={{ background: e.urgent ? '#FEF2F2' : '#F0F9FF', color: e.urgent ? '#EF4444' : '#0284C7' }}>
                {e.type === 'registration' ? <CheckCircle size={12} /> : <Users size={12} />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>{e.title}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{e.date}</div>
                {e.urgent && <span className="rounded-full px-1.5 py-0.5"
                  style={{ fontSize: 9, fontWeight: 700, background: '#FEF2F2', color: '#EF4444' }}>Urgent</span>}
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
            {[['Mon', '#4338CA', 70], ['Tue', '#059669', 40], ['Wed', '#0EA5E9', 85], ['Thu', '#7C3AED', 30], ['Fri', '#10B981', 95]].map(([day, color, pct]) => (
              <div key={day as string} className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: '#64748B', width: 28, fontWeight: 600 }}>{day}</span>
                <div className="flex-1 rounded-full h-2" style={{ background: '#F1F5F9' }}>
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color as string }} />
                </div>
                <span style={{ fontSize: 10, color: '#94A3B8', width: 24, textAlign: 'right' }}>{pct}%</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>% of friends free</div>
        </div>

        {/* Trending */}
        <div className="p-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Trending Courses</div>
          {TRENDING_COURSES.map((c) => (
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
          {TRENDING_PROFS.map((p) => (
            <div key={p.name} className="flex items-center gap-2.5 mb-3 last:mb-0">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #4338CA 0%, #8B5CF6 100%)', fontSize: 11, fontWeight: 700, color: 'white' }}>
                {p.name.split(' ').map((w) => w[0]).join('').slice(1)}
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
