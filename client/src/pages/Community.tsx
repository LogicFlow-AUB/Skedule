import { useState, useContext } from 'react'
import { Heart, Bookmark, MoreHorizontal, UserPlus, Calendar, Star, MessageCircle, TrendingUp, CheckCircle, X, BookOpen, Clock } from 'lucide-react'
import { AppContext } from '../context'

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
    badges: [{ label: 'CS Student', color: 'var(--color-primary)' }],
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
    badges: [{ label: 'Senior', color: '#7C3AED' }],
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
    badges: [],
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
    badges: [{ label: 'CS Student', color: 'var(--color-primary)' }],
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
  { name: 'Sarah K.', major: 'CS', year: 'Junior', status: 'online', sharedCourses: 2, avatar: 'SK', avatarColor: 'var(--color-primary)' },
  { name: 'Karim A.', major: 'CS', year: 'Junior', status: 'online', sharedCourses: 3, avatar: 'KA', avatarColor: '#059669' },
  { name: 'Lara M.', major: 'EECE', year: 'Senior', status: 'away', sharedCourses: 1, avatar: 'LM', avatarColor: '#7C3AED' },
  { name: 'Nour H.', major: 'Math', year: 'Sophomore', status: 'offline', sharedCourses: 2, avatar: 'NH', avatarColor: '#D97706' },
  { name: 'Ziad T.', major: 'Physics', year: 'Junior', status: 'online', sharedCourses: 1, avatar: 'ZT', avatarColor: '#0EA5E9' },
]

const SUGGESTED = [
  { name: 'Dina F.', major: 'CS', year: 'Junior', mutual: 5, avatar: 'DF', avatarColor: '#EC4899' },
  { name: 'Rami S.', major: 'EECE', year: 'Sophomore', mutual: 3, avatar: 'RS', avatarColor: 'var(--color-primary-grad)' },
]

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  'Schedule Tips': { bg: 'var(--color-primary-light)', text: 'var(--color-primary)' },
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
  schedule: 'var(--color-primary)',
  review: '#F59E0B',
  question: '#059669',
  tip: '#D97706',
}

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(post.liked)
  const [saved, setSaved] = useState(post.saved)
  const [likeCount, setLikeCount] = useState(post.likes)

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
          style={{ width: 40, height: 40, background: `linear-gradient(135deg, ${post.badges[0]?.color ?? 'var(--color-primary)'} 0%, ${post.badges[0]?.color ?? 'var(--color-primary-grad)'}BB 100%)`, color: 'white', fontSize: 14 }}>
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
            <Calendar size={12} color="var(--color-primary)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>Schedule Preview · {post.schedulePreview.days}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {post.schedulePreview.courses.map((c) => (
              <span key={c} className="rounded-lg px-2 py-1"
                style={{ fontSize: 11, fontWeight: 700, background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>{c}</span>
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
      </div>
    </div>
  )
}

export default function Community() {
  const { userName } = useContext(AppContext)
  const initials = userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const [activeCompose, setActiveCompose] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [addedFriends, setAddedFriends] = useState<Set<string>>(new Set())
  const [selectedFriend, setSelectedFriend] = useState<typeof FRIENDS[0] | null>(null)
  const [showSharedSchedule, setShowSharedSchedule] = useState(false)
  const posts = POSTS

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* Left: Friends list */}
      <aside className="flex flex-col shrink-0 h-full overflow-y-auto"
        style={{ width: 220, background: '#FFFFFF', borderRight: '1px solid #F1F5F9' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>Friends</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{FRIENDS.length} friends</div>
        </div>

        <div className="px-3 py-3 flex-1">
          {/* All Friends */}
          {FRIENDS.map((f) => (
            <button key={f.name} onClick={() => setSelectedFriend(f)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors"
              style={{ textAlign: 'left' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <div className="relative shrink-0">
                <div className="rounded-full flex items-center justify-center"
                  style={{ width: 32, height: 32, background: f.avatarColor + '20', color: f.avatarColor, fontSize: 11, fontWeight: 700 }}>
                  {f.avatar}
                </div>
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
          {SUGGESTED.map((s) => {
            const added = addedFriends.has(s.name)
            return (
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
              <button onClick={() => setAddedFriends(p => new Set(p).add(s.name))} style={{ color: added ? '#10B981' : 'var(--color-primary)' }}>
                {added ? <CheckCircle size={14} /> : <UserPlus size={14} />}
              </button>
            </div>
          )})}
        </div>
      </aside>

      {/* Center: Feed */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4">
          {/* Compose */}
          <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--color-primary-grad) 0%, #8B5CF6 100%)', fontSize: 12, fontWeight: 700, color: 'white' }}>
                {initials}
              </div>
              <button
                onClick={() => setActiveCompose(true)}
                className="flex-1 rounded-xl px-4 py-2.5 text-left transition-colors"
                style={{ fontSize: 13, color: '#94A3B8', background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid var(--color-primary-border)' }}
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
                      style={{ fontSize: 12, background: composeText ? 'var(--color-primary)' : '#E2E8F0', color: composeText ? 'white' : '#94A3B8' }}>
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

      {/* Selected Friend Modal */}
      {selectedFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedFriend(null)}>
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', width: 400 }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full flex items-center justify-center" style={{ width: 48, height: 48, background: selectedFriend.avatarColor + '20', color: selectedFriend.avatarColor, fontSize: 16, fontWeight: 700 }}>
                  {selectedFriend.avatar}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{selectedFriend.name}</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>{selectedFriend.major}</div>
                </div>
              </div>
              <button onClick={() => setSelectedFriend(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={20} color="#64748B" />
              </button>
            </div>
            
            <div className="mb-6">
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Shared Schedules</h3>
              <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                <div className="flex items-center gap-2">
                  <Calendar size={16} color="var(--color-primary)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>Fall 2025 Schedule</span>
                </div>
                <button onClick={() => setShowSharedSchedule(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>View</button>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Common Free Time</h3>
              <div className="flex flex-col gap-2">
                <div className="rounded-xl p-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>Mondays & Wednesdays</div>
                  <div style={{ fontSize: 12, color: '#16A34A' }}>10:00 AM – 1:00 PM</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>Fridays</div>
                  <div style={{ fontSize: 12, color: '#16A34A' }}>All Day</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Schedule Modal */}
      {showSharedSchedule && selectedFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowSharedSchedule(false)}>
          <div className="rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: 560, maxHeight: '85vh', background: '#FFFFFF' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{selectedFriend.name}'s Schedule</h2>
                <p style={{ fontSize: 12, color: '#64748B' }}>15 credits · Mon–Thu</p>
              </div>
              <button onClick={() => setShowSharedSchedule(false)} className="rounded-lg p-1.5" style={{ color: '#64748B' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-3 overflow-y-auto">
              {[
                { code: 'EECE 330', name: 'Digital Systems', prof: 'Dr. Hassan', time: '10:00 AM - 11:15 AM', days: 'Mon, Wed', color: '#4338CA' },
                { code: 'MATH 201', name: 'Calculus III', prof: 'Dr. Khalil', time: '9:00 AM - 10:15 AM', days: 'Tue, Thu', color: '#059669' },
                { code: 'PHYS 211', name: 'Physics II', prof: 'Dr. Nassif', time: '1:00 PM - 2:00 PM', days: 'Mon, Wed, Fri', color: '#0284C7' },
                { code: 'EECE 351', name: 'Signals & Systems', prof: 'Dr. Farhat', time: '11:30 AM - 1:00 PM', days: 'Tue, Thu', color: '#7C3AED' },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl p-4" style={{ border: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                  <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 40, height: 40, background: c.color + '20', color: c.color }}>
                    <BookOpen size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold" style={{ fontSize: 14, color: '#1E293B' }}>{c.code}</span>
                      <span style={{ fontSize: 13, color: '#64748B' }}>{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                        <Clock size={12} /> {c.time}
                      </span>
                      <span className="flex items-center gap-1" style={{ fontSize: 12, color: '#64748B' }}>
                        <Calendar size={12} /> {c.days}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
