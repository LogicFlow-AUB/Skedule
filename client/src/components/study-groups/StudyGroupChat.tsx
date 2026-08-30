import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { api } from '../../lib/api'
import {
  formatMessageDay,
  formatMessageTime,
  mergeChatMessages,
  oldestCursor,
  toChatItem,
  type ChatItem,
} from '../../lib/chat'
import type { StudyGroup } from '../../data/studyGroups'

export default function StudyGroupChat({
  group,
  currentUserId,
  onClose,
}: {
  group: StudyGroup
  currentUserId: string
  onClose: () => void
}) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const itemsRef = useRef<ChatItem[]>([])
  const hasMoreRef = useRef(false)
  const loadingRef = useRef(false)
  const bootedRef = useRef(false)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])

  // Initial load: the latest 15-day window.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const page = await api.studyGroups.messages(group.id)
        if (cancelled) return
        setItems(page.data.map((m) => toChatItem(m, currentUserId)))
        setHasMore(page.hasMore)
        bootedRef.current = true
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [group.id, currentUserId])

  // Scroll to the newest message after the initial load completes.
  useEffect(() => {
    if (!loading && bootedRef.current) {
      endRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [loading])

  const loadOlder = useCallback(async () => {
    if (loadingRef.current) return
    if (!hasMoreRef.current) {
      setReachedEnd(true)
      return
    }
    loadingRef.current = true
    setLoadingOlder(true)
    const container = scrollRef.current
    const previousScrollHeight = container?.scrollHeight ?? 0
    try {
      const cursor = oldestCursor(itemsRef.current)
      const page = await api.studyGroups.messages(group.id, { before: cursor ?? undefined })
      setItems((current) => mergeChatMessages(current, page.data.map((m) => toChatItem(m, currentUserId))))
      setHasMore(page.hasMore)
      // Preserve the user's visual position: the content above grew by exactly
      // the prepended height, so shift the scroll offset to compensate.
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousScrollHeight
        }
      })
    } catch {
      // Transient failure; the user can simply keep scrolling up to retry.
    } finally {
      loadingRef.current = false
      setLoadingOlder(false)
    }
  }, [group.id, currentUserId])

  const onScroll = () => {
    const container = scrollRef.current
    if (!container || loadingRef.current) return
    if (container.scrollTop <= 40) {
      void loadOlder()
    }
  }

  const submit = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    try {
      const response = await api.studyGroups.sendMessage(group.id, text)
      setItems((current) => [...current, toChatItem(response.data, currentUserId)])
      setDraft('')
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'end' }))
    } catch {
      setError('Failed to send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  let renderedDay = ''

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="group-chat-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="rounded-2xl overflow-hidden w-full flex flex-col" style={{ maxWidth: 520, height: 'min(650px, 86vh)', background: '#FFFFFF', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}><div><h2 id="group-chat-title" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{group.name}</h2><p style={{ fontSize: 10, color: '#16A34A', marginTop: 2 }}>{group.memberCount} members · Group chat</p></div><button onClick={onClose} aria-label="Close chat" className="rounded-lg p-1.5" style={{ color: '#64748B' }}><X size={18} /></button></div>
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4" style={{ background: '#F8FAFC' }}>
          {loading ? (
            <div className="py-16 text-center"><Loader2 size={22} color="#CBD5E1" className="animate-spin mx-auto" /><p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Loading messages...</p></div>
          ) : loadError ? (
            <div className="py-16 text-center"><p style={{ fontSize: 12, color: '#DC2626' }}>Failed to load messages. Please try again later.</p></div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center"><p style={{ fontSize: 11, color: '#94A3B8' }}>No messages yet. Start the conversation!</p></div>
          ) : (
            <>
              <div className="text-center shrink-0" style={{ fontSize: 9, color: loadingOlder ? '#4338CA' : '#94A3B8' }}>
                {loadingOlder ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={11} className="animate-spin" />Loading chat...</span> : reachedEnd ? 'No more chat history' : hasMore ? 'Scroll up for older chat' : ''}
              </div>
              {items.map((message) => {
                const day = formatMessageDay(message.date)
                const showDay = day !== renderedDay
                renderedDay = day
                return (
                  <div key={message.id} className="flex flex-col">
                    {showDay && <div className="text-center my-2 shrink-0"><span className="rounded-full px-3 py-1 font-semibold" style={{ fontSize: 9, color: '#64748B', background: '#EFF6FF', border: '1px solid #E0E7FF' }}>{day}</span></div>}
                    <div className={`flex flex-col ${message.currentUser ? 'items-end' : 'items-start'}`}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>{message.sender}</span>
                      <div className="rounded-2xl px-3.5 py-2.5" style={{ maxWidth: '80%', fontSize: 12, lineHeight: 1.55, color: message.currentUser ? '#FFFFFF' : '#334155', background: message.currentUser ? '#4338CA' : '#FFFFFF', border: message.currentUser ? 'none' : '1px solid #E2E8F0', borderBottomRightRadius: message.currentUser ? 5 : 16, borderBottomLeftRadius: message.currentUser ? 16 : 5 }}>{message.text}</div>
                      <span style={{ fontSize: 8, color: '#94A3B8', marginTop: 4 }}>{formatMessageTime(message.date)}</span>
                    </div>
                  </div>
                )
              })}
            </>
          )}
          <div ref={endRef} />
        </div>
        <div className="p-4 flex flex-col gap-2 shrink-0" style={{ borderTop: '1px solid #F1F5F9' }}>
          {error && <p style={{ fontSize: 10, color: '#DC2626' }}>{error}</p>}
          <div className="flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} aria-label="Message" placeholder="Type a message..." className="flex-1 rounded-xl px-3.5 py-2.5 outline-none" style={{ fontSize: 12, color: '#1E293B', background: '#F8FAFC', border: '1px solid #E2E8F0' }} /><button onClick={() => void submit()} disabled={!draft.trim() || sending} aria-label="Send message" className="rounded-xl px-4 flex items-center gap-1.5 font-semibold" style={{ fontSize: 11, background: draft.trim() && !sending ? '#4338CA' : '#E2E8F0', color: draft.trim() && !sending ? '#FFFFFF' : '#94A3B8' }}>{sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}Send</button></div>
        </div>
      </div>
    </div>
  )
}
