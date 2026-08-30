import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import StudyGroupCard from '../components/study-groups/StudyGroupCard'
import StudyGroupChat from '../components/study-groups/StudyGroupChat'
import StudyGroupDetails from '../components/study-groups/StudyGroupDetails'
import { MOCK_MESSAGES, MOCK_STUDY_GROUPS, type ChatMessage, type StudyGroup } from '../data/studyGroups'

type Tab = 'explore' | 'mine'

export default function StudyGroupsPage() {
  const [tab, setTab] = useState<Tab>('explore')
  const [query, setQuery] = useState('')
  const [requestedIds, setRequestedIds] = useState<number[]>([])
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null)
  const [chatGroup, setChatGroup] = useState<StudyGroup | null>(null)
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>(MOCK_MESSAGES)
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return MOCK_STUDY_GROUPS.filter((group) => (tab === 'explore' || group.joined) && (!normalized || `${group.name} ${group.courseCode} ${group.courseName}`.toLowerCase().includes(normalized)))
  }, [query, tab])
  const request = (id: number) => setRequestedIds((current) => current.includes(id) ? current : [...current, id])
  const openChat = (group: StudyGroup) => { setSelectedGroup(null); setChatGroup(group) }
  const sendMessage = (groupId: number, text: string) => setMessages((current) => ({ ...current, [groupId]: [...(current[groupId] ?? []), { id: Date.now(), sender: 'You', text, timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), currentUser: true }] }))

  return <div className="h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
    <header className="px-5 sm:px-8 py-5" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}><div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>Skedule <span style={{ margin: '0 5px' }}>›</span> Study Groups</div><h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Study Groups</h1><p style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Find classmates, join study groups, and collaborate on your courses.</p></header>
    <main className="px-5 sm:px-8 py-6 mx-auto" style={{ maxWidth: 1240 }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex rounded-xl p-1" style={{ background: '#E2E8F0' }}>{([{ id: 'explore', label: 'Explore Groups' }, { id: 'mine', label: 'My Study Groups' }] as const).map((item) => <button key={item.id} onClick={() => setTab(item.id)} className="rounded-lg px-4 py-2 font-semibold transition-all" style={{ fontSize: 11, color: tab === item.id ? '#4338CA' : '#64748B', background: tab === item.id ? '#FFFFFF' : 'transparent', boxShadow: tab === item.id ? '0 1px 3px rgba(15,23,42,.08)' : 'none' }}>{item.label}</button>)}</div>
        <label className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 w-full sm:w-80" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}><Search size={15} color="#94A3B8" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search study groups..." className="min-w-0 flex-1 bg-transparent outline-none" style={{ fontSize: 12, color: '#1E293B' }} /></label>
      </div>
      {groups.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{groups.map((group) => <StudyGroupCard key={group.id} group={group} requested={requestedIds.includes(group.id)} onRequest={() => request(group.id)} onDetails={() => setSelectedGroup(group)} onChat={() => openChat(group)} />)}</div> : <div className="rounded-2xl py-16 px-5 text-center" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}><Users size={28} color="#CBD5E1" className="mx-auto" /><h2 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 10 }}>{tab === 'mine' && !query ? "You haven't joined any study groups yet." : 'No study groups found.'}</h2><p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{tab === 'mine' && !query ? 'Explore study groups and request to join one.' : 'Try another search.'}</p></div>}
    </main>
    {selectedGroup && <StudyGroupDetails group={selectedGroup} requested={requestedIds.includes(selectedGroup.id)} onRequest={() => request(selectedGroup.id)} onChat={() => openChat(selectedGroup)} onClose={() => setSelectedGroup(null)} />}
    {chatGroup && <StudyGroupChat group={chatGroup} messages={messages[chatGroup.id] ?? []} onSend={(text) => sendMessage(chatGroup.id, text)} onClose={() => setChatGroup(null)} />}
  </div>
}
