import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Users } from 'lucide-react'
import StudyGroupCard from '../components/study-groups/StudyGroupCard'
import StudyGroupChat from '../components/study-groups/StudyGroupChat'
import StudyGroupDetails from '../components/study-groups/StudyGroupDetails'
import CreateStudyGroupModal from '../components/study-groups/CreateStudyGroupModal'
import EditStudyGroupModal from '../components/study-groups/EditStudyGroupModal'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { toStudyGroup, type StudyGroup } from '../data/studyGroups'

type Tab = 'explore' | 'mine'

export default function StudyGroupsPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const [tab, setTab] = useState<Tab>('explore')
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<StudyGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null)
  const [chatGroup, setChatGroup] = useState<StudyGroup | null>(null)
  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = tab === 'mine' ? await api.studyGroups.mine() : await api.studyGroups.list()
      const next = response.data.map(toStudyGroup)
      setGroups(next)
      setSelectedGroup((current) => (current ? next.find((g) => g.id === current.id) ?? null : null))
    } catch {
      setLoadError('Failed to load study groups. Please try again later.')
      setGroups([])
      setSelectedGroup(null)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void loadGroups()
  }, [loadGroups])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return groups
    return groups.filter((group) =>
      `${group.name} ${group.courseCode} ${group.courseName}`.toLowerCase().includes(normalized),
    )
  }, [groups, query])

  const patchGroup = (id: number, patch: Partial<StudyGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    setSelectedGroup((current) => (current && current.id === id ? { ...current, ...patch } : current))
  }

  const request = async (group: StudyGroup) => {
    setBusyId(group.id)
    try {
      await api.studyGroups.requestToJoin(group.id)
      patchGroup(group.id, { requested: true, role: 'pending', joined: false })
    } catch {
      // leave state as-is; the reload below reconciles with the backend
    } finally {
      setBusyId(null)
    }
    void loadGroups()
  }

  const cancelRequest = async (group: StudyGroup) => {
    setBusyId(group.id)
    try {
      await api.studyGroups.cancelJoinRequest(group.id)
      patchGroup(group.id, { requested: false, role: 'none' })
    } catch {
      // leave state as-is; the reload below reconciles with the backend
    } finally {
      setBusyId(null)
    }
    void loadGroups()
  }

  const openChat = (group: StudyGroup) => { setSelectedGroup(null); setChatGroup(group) }
  const selected = selectedGroup

  return <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
    <header className="px-5 sm:px-8 py-5" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}><div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>Skedule <span style={{ margin: '0 5px' }}>›</span> Study Groups</div><h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Study Groups</h1><p style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Find classmates, join study groups, and collaborate on your courses.</p></header>
    <main className="px-5 sm:px-8 py-6 mx-auto" style={{ maxWidth: 1240 }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex rounded-xl p-1" style={{ background: '#E2E8F0' }}>{([{ id: 'explore', label: 'Explore Groups' }, { id: 'mine', label: 'My Study Groups' }] as const).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className="rounded-lg px-4 py-2 font-semibold transition-all" style={{ fontSize: 11, color: tab === item.id ? '#4338CA' : '#64748B', background: tab === item.id ? '#FFFFFF' : 'transparent', boxShadow: tab === item.id ? '0 1px 3px rgba(15,23,42,.08)' : 'none' }}>{item.label}</button>)}</div>
          <button onClick={() => setShowCreate(true)} className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-semibold" style={{ fontSize: 11, background: '#4338CA', color: '#FFFFFF' }}><Plus size={14} />Create Study Group</button>
        </div>
        <label className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 w-full sm:w-80" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}><Search size={15} color="#94A3B8" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search study groups..." className="min-w-0 flex-1 bg-transparent outline-none" style={{ fontSize: 12, color: '#1E293B' }} /></label>
      </div>
      {loading ? <div className="rounded-2xl py-16 px-5 text-center" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}><Loader2 size={26} color="#CBD5E1" className="animate-spin mx-auto" /><p style={{ fontSize: 12, color: '#94A3B8', marginTop: 10 }}>Loading study groups...</p></div> : loadError ? <div className="rounded-2xl py-16 px-5 text-center" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}><p style={{ fontSize: 13, color: '#DC2626' }}>{loadError}</p></div> : filtered.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map((group) => <StudyGroupCard key={group.id} group={group} requesting={busyId === group.id} onRequest={() => request(group)} onCancelRequest={() => cancelRequest(group)} onDetails={() => setSelectedGroup(group)} onChat={() => openChat(group)} onEdit={() => setEditingGroup(group)} />)}</div> : <div className="rounded-2xl py-16 px-5 text-center" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}><Users size={28} color="#CBD5E1" className="mx-auto" /><h2 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 10 }}>{tab === 'mine' && !query ? "You haven't joined any study groups yet." : 'No study groups found.'}</h2><p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{tab === 'mine' && !query ? 'Explore study groups and request to join one.' : 'Try another search.'}</p></div>}
    </main>
    {selected && <StudyGroupDetails group={selected} onRequest={() => request(selected)} onCancelRequest={() => cancelRequest(selected)} onChat={() => openChat(selected)} onEdit={() => setEditingGroup(selected)} onClose={() => setSelectedGroup(null)} onChanged={() => loadGroups()} />}
    {chatGroup && <StudyGroupChat group={chatGroup} currentUserId={currentUserId} onClose={() => setChatGroup(null)} />}
    {editingGroup && <EditStudyGroupModal group={editingGroup} onChanged={() => loadGroups()} onClose={() => setEditingGroup(null)} />}
    {showCreate && <CreateStudyGroupModal onCreate={() => { if (tab === 'mine') { void loadGroups() } else { setTab('mine') } }} onClose={() => setShowCreate(false)} />}
  </div>
}
