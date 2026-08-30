import { CalendarDays, Check, MessageCircle, UserRound, Users } from 'lucide-react'
import type { StudyGroup } from '../../data/studyGroups'

export default function StudyGroupCard({ group, requested, onRequest, onDetails, onChat }: { group: StudyGroup; requested: boolean; onRequest: () => void; onDetails: () => void; onChat: () => void }) {
  return <article className="rounded-2xl p-5 flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', minHeight: 270 }}>
    <div className="flex items-start justify-between gap-3">
      <span className="rounded-lg px-2.5 py-1" style={{ fontSize: 10, fontWeight: 800, color: '#4338CA', background: '#EEF2FF' }}>{group.courseCode}</span>
      {group.joined && <span className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, color: '#15803D' }}><Check size={12} /> Joined</span>}
    </div>
    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 14 }}>{group.name}</h2>
    <p style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{group.courseName}</p>
    <p className="flex-1" style={{ fontSize: 12, lineHeight: 1.65, color: '#64748B', marginTop: 12 }}>{group.description}</p>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4" style={{ fontSize: 10, color: '#94A3B8' }}>
      <span className="flex items-center gap-1"><UserRound size={12} />{group.founder}</span>
      <span className="flex items-center gap-1"><Users size={12} />{group.memberCount} members</span>
      <span className="flex items-center gap-1"><CalendarDays size={12} />{group.createdAt}</span>
    </div>
    <div className="flex gap-2">
      {!group.joined && <button onClick={onRequest} disabled={requested} className="flex-1 rounded-lg px-3 py-2 font-semibold transition-colors" style={{ fontSize: 11, background: requested ? '#F0FDF4' : '#4338CA', color: requested ? '#15803D' : '#FFFFFF', border: requested ? '1px solid #BBF7D0' : '1px solid #4338CA' }}>{requested ? 'Request Sent' : 'Request to Join'}</button>}
      {group.joined && <button onClick={onChat} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-semibold" style={{ fontSize: 11, background: '#4338CA', color: '#FFFFFF' }}><MessageCircle size={13} />Chat</button>}
      <button onClick={onDetails} className="flex-1 rounded-lg px-3 py-2 font-semibold" style={{ fontSize: 11, background: '#FFFFFF', color: '#4338CA', border: '1px solid #C7D2FE' }}>{group.joined ? 'View Group' : 'View Details'}</button>
    </div>
  </article>
}
