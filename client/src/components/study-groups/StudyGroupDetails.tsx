import { BookOpen, CalendarDays, Clock3, MessageCircle, UserRound, Users, X } from 'lucide-react'
import type { StudyGroup } from '../../data/studyGroups'

export default function StudyGroupDetails({ group, requested, onRequest, onChat, onClose }: { group: StudyGroup; requested: boolean; onRequest: () => void; onChat: () => void; onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="group-details-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="rounded-2xl overflow-hidden w-full" style={{ maxWidth: 570, background: '#FFFFFF', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
      <div className="px-6 py-5 flex items-start justify-between" style={{ background: '#EEF2FF', borderBottom: '1px solid #E0E7FF' }}><div><span style={{ fontSize: 10, fontWeight: 800, color: '#4338CA' }}>{group.courseCode}</span><h2 id="group-details-title" style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{group.name}</h2></div><button onClick={onClose} aria-label="Close details" className="rounded-lg p-1.5" style={{ color: '#64748B' }}><X size={18} /></button></div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[{ icon: <BookOpen size={14} />, label: 'Course', value: `${group.courseCode} – ${group.courseName}` }, { icon: <UserRound size={14} />, label: 'Founder', value: group.founder }, { icon: <CalendarDays size={14} />, label: 'Date created', value: group.createdAt }, { icon: <Users size={14} />, label: 'Members', value: `${group.memberCount} students` }, { icon: <Clock3 size={14} />, label: 'Meets', value: group.meetingFrequency }].map((item) => <div key={item.label} className="flex gap-2.5 rounded-xl p-3" style={{ background: '#F8FAFC' }}><span style={{ color: '#6366F1' }}>{item.icon}</span><div><div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.label}</div><div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginTop: 2 }}>{item.value}</div></div></div>)}
        </div>
        <div className="mt-5"><h3 style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>About this group</h3><p style={{ fontSize: 12, lineHeight: 1.75, color: '#64748B', marginTop: 7 }}>{group.details}</p></div>
        <div className="flex justify-end gap-2 mt-6">{group.joined ? <button onClick={onChat} className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#4338CA', color: '#FFFFFF' }}><MessageCircle size={14} />Open Chat</button> : <button onClick={onRequest} disabled={requested} className="rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: requested ? '#F0FDF4' : '#4338CA', color: requested ? '#15803D' : '#FFFFFF' }}>{requested ? 'Request Sent' : 'Request to Join'}</button>}</div>
      </div>
    </div>
  </div>
}
