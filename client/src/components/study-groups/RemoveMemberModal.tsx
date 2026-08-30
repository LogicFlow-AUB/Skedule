import { Loader2, UserX, X } from 'lucide-react'

type Props = {
  memberName: string
  removing: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function RemoveMemberModal({ memberName, removing, onConfirm, onCancel }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="remove-member-title" className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={(event) => { if (event.target === event.currentTarget && !removing) onCancel() }}>
      <div className="rounded-2xl overflow-hidden w-full" style={{ maxWidth: 380, background: '#FFFFFF', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
        <div className="px-5 py-4 flex items-start justify-between" style={{ background: '#EEF2FF', borderBottom: '1px solid #E0E7FF' }}>
          <h3 id="remove-member-title" style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Remove member</h3>
          <button onClick={onCancel} disabled={removing} aria-label="Close" className="rounded-lg p-1.5" style={{ color: '#64748B' }}><X size={17} /></button>
        </div>
        <div className="p-5">
          <p style={{ fontSize: 12, lineHeight: 1.65, color: '#475569' }}>
            Are you sure you want to remove <strong>{memberName}</strong> from this study group? They will lose access to the group and its chat.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onCancel} disabled={removing} className="rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancel</button>
            <button onClick={onConfirm} disabled={removing} className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold" style={{ fontSize: 12, background: '#B91C1C', color: '#FFFFFF' }}>{removing ? <Loader2 size={13} className="animate-spin" /> : <UserX size={13} />}{removing ? 'Removing...' : 'Remove'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
