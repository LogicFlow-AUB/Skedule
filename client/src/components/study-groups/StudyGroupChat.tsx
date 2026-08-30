import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import type { ChatMessage, StudyGroup } from '../../data/studyGroups'

export default function StudyGroupChat({ group, messages, onSend, onClose }: { group: StudyGroup; messages: ChatMessage[]; onSend: (text: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  const submit = () => { const text = draft.trim(); if (!text) return; onSend(text); setDraft('') }
  return <div role="dialog" aria-modal="true" aria-labelledby="group-chat-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="rounded-2xl overflow-hidden w-full flex flex-col" style={{ maxWidth: 520, height: 'min(650px, 86vh)', background: '#FFFFFF', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}><div><h2 id="group-chat-title" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{group.name}</h2><p style={{ fontSize: 10, color: '#16A34A', marginTop: 2 }}>{group.memberCount} members · Group chat</p></div><button onClick={onClose} aria-label="Close chat" className="rounded-lg p-1.5" style={{ color: '#64748B' }}><X size={18} /></button></div>
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4" style={{ background: '#F8FAFC' }}>{messages.map((message) => <div key={message.id} className={`flex flex-col ${message.currentUser ? 'items-end' : 'items-start'}`}><span style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>{message.sender}</span><div className="rounded-2xl px-3.5 py-2.5" style={{ maxWidth: '80%', fontSize: 12, lineHeight: 1.55, color: message.currentUser ? '#FFFFFF' : '#334155', background: message.currentUser ? '#4338CA' : '#FFFFFF', border: message.currentUser ? 'none' : '1px solid #E2E8F0', borderBottomRightRadius: message.currentUser ? 5 : 16, borderBottomLeftRadius: message.currentUser ? 16 : 5 }}>{message.text}</div><span style={{ fontSize: 8, color: '#94A3B8', marginTop: 4 }}>{message.timestamp}</span></div>)}<div ref={endRef} /></div>
      <div className="p-4 flex gap-2" style={{ borderTop: '1px solid #F1F5F9' }}><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} aria-label="Message" placeholder="Type a message..." className="flex-1 rounded-xl px-3.5 py-2.5 outline-none" style={{ fontSize: 12, color: '#1E293B', background: '#F8FAFC', border: '1px solid #E2E8F0' }} /><button onClick={submit} disabled={!draft.trim()} aria-label="Send message" className="rounded-xl px-4 flex items-center gap-1.5 font-semibold" style={{ fontSize: 11, background: draft.trim() ? '#4338CA' : '#E2E8F0', color: draft.trim() ? '#FFFFFF' : '#94A3B8' }}><Send size={13} />Send</button></div>
    </div>
  </div>
}
