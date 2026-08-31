import { CalendarDays, Check, Clock3, Crown, Inbox, MessageCircle, Pencil, UserRound, Users } from 'lucide-react'
import type { StudyGroup } from '../../data/studyGroups'

type Props = {
  group: StudyGroup
  requesting: boolean
  onRequest: () => void
  onCancelRequest: () => void
  onDetails: () => void
  onChat: () => void
  onEdit: () => void
}

export default function StudyGroupCard({ group, requesting, onRequest, onCancelRequest, onDetails, onChat, onEdit }: Props) {
  const status = group.role === 'owner'
    ? { icon: <Crown size={12} />, label: 'Owner', color: '#B45309', bg: '#FEF3C7' }
    : group.joined
      ? { icon: <Check size={12} />, label: 'Joined', color: '#15803D', bg: '#F0FDF4' }
      : group.requested
        ? { icon: <Check size={12} />, label: 'Request Sent', color: '#1D4ED8', bg: '#EFF6FF' }
        : null

  const pendingCount = group.role === 'owner' ? (group.pendingRequestCount ?? 0) : 0

  return <article className="rounded-2xl p-5 flex flex-col" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', minHeight: 270 }}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-lg px-2.5 py-1" style={{ fontSize: 10, fontWeight: 800, color: '#4338CA', background: '#EEF2FF' }}>{group.courseCode}</span>
        {status && <span className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ fontSize: 10, fontWeight: 700, color: status.color, background: status.bg }}>{status.icon}{status.label}</span>}
      </div>
      {pendingCount > 0 && <button onClick={onDetails} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 shrink-0" style={{ fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FEF3C7', border: '1px solid #FDE68A' }}><Inbox size={11} />{pendingCount} {pendingCount === 1 ? 'Join Request' : 'Join Requests'}</button>}
    </div>
    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginTop: 14 }}>{group.name}</h2>
    <p style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{group.courseName}</p>
    <p className="flex-1" style={{ fontSize: 12, lineHeight: 1.65, color: '#64748B', marginTop: 12 }}>{group.description}</p>
    <div className="flex items-center gap-1.5 mt-3" style={{ fontSize: 11, fontWeight: 600, color: '#4338CA' }}><Clock3 size={13} />{group.meetingFrequency}</div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 mt-1" style={{ fontSize: 10, color: '#94A3B8' }}>
      <span className="flex items-center gap-1"><UserRound size={12} />{group.founder}</span>
      <span className="flex items-center gap-1"><Users size={12} />{group.memberCount} members</span>
      <span className="flex items-center gap-1"><CalendarDays size={12} />{group.createdAt}</span>
    </div>
    <div className="flex gap-2">
      {group.joined ? <button onClick={onChat} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-semibold" style={{ fontSize: 11, background: '#4338CA', color: '#FFFFFF' }}><MessageCircle size={13} />Chat</button> : group.requested ? <button onClick={onCancelRequest} disabled={requesting} className="flex-1 rounded-lg px-3 py-2 font-semibold transition-colors" style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>{requesting ? 'Cancelling...' : 'Request Sent'}</button> : <button onClick={onRequest} disabled={requesting} className="flex-1 rounded-lg px-3 py-2 font-semibold transition-colors" style={{ fontSize: 11, background: requesting ? '#C7D2FE' : '#4338CA', color: '#FFFFFF', border: '1px solid #4338CA' }}>{requesting ? 'Sending...' : 'Request to Join'}</button>}
      <button onClick={onDetails} className="flex-1 rounded-lg px-3 py-2 font-semibold" style={{ fontSize: 11, background: '#FFFFFF', color: '#4338CA', border: '1px solid #C7D2FE' }}>{group.joined ? 'View Group' : 'View Details'}</button>
      {group.role === 'owner' && <button onClick={onEdit} aria-label="Edit group" className="rounded-lg px-2.5 flex items-center justify-center" style={{ fontSize: 11, background: '#FFFFFF', color: '#4338CA', border: '1px solid #C7D2FE' }}><Pencil size={13} /></button>}
    </div>
  </article>
}
