import { useCallback, useEffect, useState } from 'react'
import { BookOpen, CalendarDays, Clock3, Crown, Loader2, MessageCircle, Pencil, UserRound, UserX, Users, X } from 'lucide-react'
import { api, type StudyGroupDetail, type StudyGroupJoinRequest } from '../../lib/api'
import { displayName, type StudyGroup } from '../../data/studyGroups'
import RemoveMemberModal from './RemoveMemberModal'

type Props = {
  group: StudyGroup
  onRequest: () => void
  onCancelRequest: () => void
  onChat: () => void
  onEdit: () => void
  onClose: () => void
  onChanged: () => void
}

export default function StudyGroupDetails({ group, onRequest, onCancelRequest, onChat, onEdit, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<StudyGroupDetail | null>(null)
  const [requests, setRequests] = useState<StudyGroupJoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)

  const ownerId = detail?.owner?.id ?? ''
  const isOwner = detail?.role === 'owner' || group.role === 'owner'

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const detailData = await api.studyGroups.get(group.id)
      setDetail(detailData)
      if (detailData.role === 'owner') {
        const req = await api.studyGroups.joinRequests(group.id)
        setRequests(req.data)
      } else {
        setRequests([])
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [group.id])

  useEffect(() => { void load() }, [load])

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id)
    try { await fn(); onChanged(); await load() } catch { /* handled by generic refresh */ } finally { setBusy(null) }
  }

  const removeMember = async () => {
    if (!removeTarget) return
    const memberId = removeTarget.id
    setBusy(memberId)
    try {
      await api.studyGroups.removeMember(group.id, memberId)
      setRemoveTarget(null)
      onChanged()
      await load()
    } catch {
      // keep the confirmation open; the user can retry or cancel
    } finally {
      setBusy(null)
    }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="group-details-title" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="rounded-2xl overflow-hidden w-full max-h-[90vh] flex flex-col" style={{ maxWidth: 570, background: '#FFFFFF', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
      <div className="px-6 py-5 flex items-start justify-between shrink-0" style={{ background: '#EEF2FF', borderBottom: '1px solid #E0E7FF' }}><div><span style={{ fontSize: 10, fontWeight: 800, color: '#4338CA' }}>{group.courseCode}</span><h2 id="group-details-title" style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>{group.name}</h2></div><div className="flex items-center gap-2">{isOwner && <button onClick={onEdit} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold" style={{ fontSize: 11, background: '#FFFFFF', color: '#4338CA', border: '1px solid #C7D2FE' }}><Pencil size={12} />Edit</button>}<button onClick={onClose} aria-label="Close details" className="rounded-lg p-1.5" style={{ color: '#64748B' }}><X size={18} /></button></div></div>
      <div className="overflow-y-auto p-6">
        {loading ? <div className="py-16 text-center"><Loader2 size={24} color="#CBD5E1" className="animate-spin mx-auto" /><p style={{ fontSize: 12, color: '#94A3B8', marginTop: 10 }}>Loading group details...</p></div> : loadError ? <div className="py-16 text-center"><p style={{ fontSize: 13, color: '#DC2626' }}>Failed to load group details. Please try again later.</p></div> : <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{ icon: <BookOpen size={14} />, label: 'Course', value: `${group.courseCode} – ${group.courseName}` }, { icon: <UserRound size={14} />, label: 'Founder', value: group.founder }, { icon: <CalendarDays size={14} />, label: 'Date created', value: group.createdAt }, { icon: <Users size={14} />, label: 'Members', value: `${detail?.memberCount ?? group.memberCount} students` }, { icon: <Clock3 size={14} />, label: 'Meets', value: group.meetingFrequency }].map((item) => <div key={item.label} className="flex gap-2.5 rounded-xl p-3" style={{ background: '#F8FAFC' }}><span style={{ color: '#6366F1' }}>{item.icon}</span><div><div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{item.label}</div><div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginTop: 2 }}>{item.value}</div></div></div>)}
          </div>
          <div className="mt-5"><h3 style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>About this group</h3><p style={{ fontSize: 12, lineHeight: 1.75, color: '#64748B', marginTop: 7 }}>{group.details}</p></div>

          <div className="mt-5"><h3 style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>Members <span style={{ color: '#94A3B8', fontWeight: 600 }}>({detail?.members.length ?? group.memberCount})</span></h3><div className="mt-2 flex flex-col gap-1.5">{detail && detail.members.length === 0 ? <p style={{ fontSize: 11, color: '#94A3B8' }}>No members yet.</p> : detail?.members.map((member) => <div key={member.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#F8FAFC' }}><span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 24, height: 24, fontSize: 10, fontWeight: 800, color: '#4338CA', background: '#EEF2FF' }}>{(displayName(member.firstName, member.lastName)[0] ?? '?').toUpperCase()}</span><span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{displayName(member.firstName, member.lastName)}</span>{member.id === ownerId ? <span className="flex items-center gap-0.5 ml-auto" style={{ fontSize: 9, fontWeight: 700, color: '#B45309' }}><Crown size={10} />Owner</span> : isOwner ? <button onClick={() => setRemoveTarget({ id: member.id, name: displayName(member.firstName, member.lastName) })} disabled={busy === member.id} aria-label={`Remove ${displayName(member.firstName, member.lastName)}`} className="flex items-center gap-1 ml-auto rounded-lg px-2 py-1 font-semibold" style={{ fontSize: 10, color: '#B91C1C', background: '#FFFFFF', border: '1px solid #FECACA' }}><UserX size={11} />Remove</button> : null}</div>)}</div></div>

          {detail && detail.role === 'owner' && (
            <div className="mt-5"><h3 style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>Join requests <span style={{ color: '#94A3B8', fontWeight: 600 }}>({requests.length})</span></h3><div className="mt-2 flex flex-col gap-2">{requests.length === 0 ? <p style={{ fontSize: 11, color: '#94A3B8' }}>No pending requests.</p> : requests.map((request) => <div key={request.userId} className="rounded-xl px-3 py-2.5" style={{ background: '#F8FAFC', border: '1px solid #EEF2FF' }}><div className="flex items-center gap-2"><span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 26, height: 26, fontSize: 10, fontWeight: 800, color: '#4338CA', background: '#EEF2FF' }}>{(displayName(request.user?.firstName ?? null, request.user?.lastName ?? null)[0] ?? '?').toUpperCase()}</span><div className="min-w-0"><div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{displayName(request.user?.firstName ?? null, request.user?.lastName ?? null)}</div><div style={{ fontSize: 9, color: '#94A3B8' }}>Requested {new Date(request.createdAt).toLocaleDateString()}</div></div></div><div className="flex gap-2 mt-2.5">{busy === request.userId ? <span className="flex items-center gap-1" style={{ fontSize: 10, color: '#94A3B8' }}><Loader2 size={12} className="animate-spin" />Working...</span> : <><button onClick={() => act(request.userId, () => api.studyGroups.acceptRequest(group.id, request.userId))} className="flex-1 rounded-lg px-3 py-1.5 font-semibold" style={{ fontSize: 11, background: '#15803D', color: '#FFFFFF' }}>Accept</button><button onClick={() => act(request.userId, () => api.studyGroups.rejectRequest(group.id, request.userId))} className="flex-1 rounded-lg px-3 py-1.5 font-semibold" style={{ fontSize: 11, background: '#FFFFFF', color: '#B91C1C', border: '1px solid #FECACA' }}>Reject</button></>}</div></div>)}</div></div>
          )}

          <div className="flex justify-end gap-2 mt-6 shrink-0">{detail?.joined || group.joined ? <button onClick={onChat} className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#4338CA', color: '#FFFFFF' }}><MessageCircle size={14} />Open Chat</button> : detail?.requested || group.requested ? <button onClick={onCancelRequest} className="rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>Cancel Request</button> : <button onClick={onRequest} className="rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#4338CA', color: '#FFFFFF' }}>Request to Join</button>}</div>
        </>}
      </div>
    </div>
    {removeTarget && <RemoveMemberModal memberName={removeTarget.name} removing={busy === removeTarget.id} onConfirm={() => void removeMember()} onCancel={() => { if (busy !== removeTarget.id) setRemoveTarget(null) }} />}
  </div>
}
