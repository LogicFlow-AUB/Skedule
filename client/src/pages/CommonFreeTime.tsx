import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Clock3, Users } from 'lucide-react'
import { api, type FriendProfile, type ScheduleDetail } from '../lib/api'
import { displayName } from '../lib/format'

interface BusyBlock { days: number[]; startMinutes: number; endMinutes: number }
type PersonStatus = 'loading' | 'ready' | 'no-schedule' | 'error'
interface AvailabilityPerson { id: string; name: string; color: string; blocks: BusyBlock[]; status: PersonStatus }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const GRID_START = 7
const GRID_END = 21
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, index) => GRID_START + index)
const PERSON_COLORS = ['#059669', '#0284C7', '#7C3AED', '#D97706', '#0EA5E9', '#DC2626', '#EC4899', '#6366F1']

function colorForId(id: string) {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return PERSON_COLORS[hash % PERSON_COLORS.length]
}

function blocksFromSchedule(detail: ScheduleDetail | null): BusyBlock[] {
  if (!detail) return []
  return detail.courses.flatMap((course) => {
    const section = course.section
    if (section.startMinutes == null || section.endMinutes == null || section.days.length === 0) return []
    return [{ days: section.days, startMinutes: section.startMinutes, endMinutes: section.endMinutes }]
  })
}

function formatH(hour: number) {
  if (hour === 12) return '12:00 PM'
  if (hour > 12) return `${hour - 12}:00 PM`
  return `${hour}:00 AM`
}

function isBusy(person: AvailabilityPerson, day: number, hour: number) {
  const slotStart = hour * 60
  const slotEnd = slotStart + 60
  return person.blocks.some((block) => block.days.includes(day) && block.startMinutes < slotEnd && block.endMinutes > slotStart)
}

function getCommonFreeSlots(people: AvailabilityPerson[]) {
  if (people.length === 0) return []
  return DAYS.flatMap((dayName, day) => {
    const slots: { day: string; startH: number; endH: number }[] = []
    let start: number | null = null
    for (let hour = GRID_START; hour <= GRID_END; hour += 1) {
      const free = hour < GRID_END && people.every((person) => !isBusy(person, day, hour))
      if (free && start == null) start = hour
      if (!free && start != null) { slots.push({ day: dayName, startH: start, endH: hour }); start = null }
    }
    return slots
  })
}

export default function CommonFreeTime() {
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [ownSchedule, setOwnSchedule] = useState<ScheduleDetail | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>(['you'])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [cacheVersion, setCacheVersion] = useState(0)

  const scheduleCacheRef = useRef<Map<string, ScheduleDetail | null>>(new Map())
  const pendingRef = useRef<Set<string>>(new Set())
  const errorIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [friendsRes, schedulesRes] = await Promise.all([api.friends.list(), api.schedules.list(1, 100)])
        if (cancelled) return
        setFriends(friendsRes.data)

        // Only the current student's PREFERRED saved schedule participates.
        const preferred = schedulesRes.data.find((schedule) => schedule.isFavorite)
        if (preferred) {
          const detail = await api.schedules.get(preferred.id)
          if (!cancelled) setOwnSchedule(detail.data)
        } else if (!cancelled) {
          setOwnSchedule(null)
        }
      } catch {
        if (!cancelled) setLoadError('Failed to load your schedule and friends. Please try again later.')
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const idsToFetch = selectedIds.filter(
      (id) => id !== 'you' && !scheduleCacheRef.current.has(id) && !pendingRef.current.has(id) && !errorIdsRef.current.has(id),
    )
    if (idsToFetch.length === 0) return

    let cancelled = false
    idsToFetch.forEach((id) => pendingRef.current.add(id))
    setCacheVersion((version) => version + 1)

    void Promise.all(
      idsToFetch.map(async (id) => {
        try {
          const res = await api.friends.schedule(id)
          scheduleCacheRef.current.set(id, res.data)
        } catch {
          errorIdsRef.current.add(id)
        } finally {
          pendingRef.current.delete(id)
        }
      }),
    ).then(() => {
      if (!cancelled) setCacheVersion((version) => version + 1)
    })

    return () => { cancelled = true }
  }, [selectedIds])

  const selectablePeople = useMemo(
    () => [{ id: 'you', name: 'You' }, ...friends.map((friend) => ({ id: friend.id, name: displayName(friend.firstName, friend.lastName) }))],
    [friends],
  )

  const selectedPeople: AvailabilityPerson[] = useMemo(() => selectedIds.map((id) => {
    if (id === 'you') {
      return { id: 'you', name: 'You', color: 'var(--color-primary)', blocks: blocksFromSchedule(ownSchedule), status: 'ready' as PersonStatus }
    }

    const friend = friends.find((f) => f.id === id)
    const name = friend ? displayName(friend.firstName, friend.lastName) : 'Friend'
    const color = colorForId(id)

    if (errorIdsRef.current.has(id)) {
      return { id, name, color, blocks: [], status: 'error' as PersonStatus }
    }

    if (pendingRef.current.has(id) || !scheduleCacheRef.current.has(id)) {
      return { id, name, color, blocks: [], status: 'loading' as PersonStatus }
    }

    const cached = scheduleCacheRef.current.get(id) ?? null
    if (!cached) {
      return { id, name, color, blocks: [], status: 'no-schedule' as PersonStatus }
    }

    return { id, name, color, blocks: blocksFromSchedule(cached), status: 'ready' as PersonStatus }
  }), [selectedIds, friends, ownSchedule, cacheVersion])

  const readyPeople = useMemo(() => selectedPeople.filter((person) => person.status === 'ready'), [selectedPeople])
  const freeSlots = useMemo(() => getCommonFreeSlots(readyPeople), [readyPeople])
  const pendingCount = selectedPeople.length - readyPeople.length

  const togglePerson = (id: string) => {
    if (id === 'you') return
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  return <div className="h-full overflow-auto" style={{ background: '#F8FAFC' }}>
    <header className="px-8 py-5" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>Skedule <span style={{ margin: '0 5px' }}>›</span> Common Free Time</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Common Free Time</h1>
      <p style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Find overlapping free time with your friends.</p>
    </header>

    {initialLoading ? (
      <div className="p-6" style={{ fontSize: 13, color: '#64748B' }}>Loading your schedule and friends…</div>
    ) : loadError ? (
      <div className="p-6" style={{ fontSize: 13, color: '#DC2626' }}>{loadError}</div>
    ) : ownSchedule === null ? (
      <div className="p-6">
        <section className="rounded-2xl p-8 flex flex-col items-center text-center gap-2" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <Clock3 size={22} color="#94A3B8" />
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>No saved schedule yet</div>
          <p style={{ fontSize: 12, color: '#64748B', maxWidth: 380 }}>Save a schedule from the Schedule Builder to see your free time and compare it with friends here.</p>
        </section>
      </div>
    ) : (
      <div className="p-6 grid gap-5 items-start" style={{ gridTemplateColumns: 'minmax(680px, 1fr) 300px' }}>
        <section className="rounded-2xl overflow-hidden min-w-0" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div><div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Weekly availability</div><div style={{ fontSize: 11, color: '#94A3B8' }}>Hourly view · 7:00 AM–9:00 PM</div></div>
            <div className="flex flex-wrap gap-3">{selectedPeople.map((person) => <div key={person.id} className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#475569' }}><span className="rounded-full" style={{ width: 8, height: 8, background: person.color }} />{person.name}{person.status === 'loading' && <span style={{ color: '#94A3B8' }}>(loading…)</span>}{person.status === 'no-schedule' && <span style={{ color: '#94A3B8' }}>(no saved schedule)</span>}{person.status === 'error' && <span style={{ color: '#DC2626' }}>(couldn't load)</span>}</div>)}<div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#15803D' }}><span className="rounded-full" style={{ width: 8, height: 8, background: '#22C55E' }} />All free</div></div>
          </div>
          {pendingCount > 0 && <div className="px-5 py-2" style={{ fontSize: 11, color: '#94A3B8', borderBottom: '1px solid #F8FAFC' }}>Comparing {readyPeople.length} of {selectedPeople.length} selected people — others are still loading or have no saved schedule.</div>}
          <div className="overflow-x-auto">
            <div style={{ minWidth: 680 }}>
              <div className="grid" style={{ gridTemplateColumns: '80px repeat(5, minmax(110px, 1fr))' }}><div /><>{DAYS.map((day) => <div key={day} className="py-3 text-center" style={{ fontSize: 12, fontWeight: 700, color: '#475569', borderLeft: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>{day}</div>)}</></div>
              {HOURS.map((hour) => <div key={hour} className="grid" style={{ gridTemplateColumns: '80px repeat(5, minmax(110px, 1fr))' }}>
                <div className="pr-3 pt-2 text-right" style={{ height: 48, fontSize: 10, color: '#94A3B8', borderBottom: '1px solid #F8FAFC' }}>{formatH(hour)}</div>
                {DAYS.map((_, day) => { const busy = readyPeople.filter((person) => isBusy(person, day, hour)); const allFree = busy.length === 0; const background = allFree ? '#F0FDF4' : busy.length === 1 ? `${busy[0].color}18` : `repeating-linear-gradient(135deg, ${busy[0].color}18 0 8px, ${busy[1].color}18 8px 16px)`; return <div key={day} title={allFree ? 'Everyone is free' : `Busy: ${busy.map((person) => person.name).join(', ')}`} className="px-2 py-1.5 overflow-hidden" style={{ height: 48, background, borderLeft: `1px solid ${allFree ? '#BBF7D0' : '#F1F5F9'}`, borderBottom: `1px solid ${allFree ? '#BBF7D0' : '#F1F5F9'}` }}>{allFree ? <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A' }}>Free</span> : <span className="block truncate" style={{ fontSize: 9, color: '#64748B' }}>{busy.map((person) => person.name).join(', ')}</span>}</div> })}
              </div>)}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2 mb-3"><Users size={15} color="var(--color-primary)" /><b style={{ fontSize: 13 }}>Compare with friends</b></div>
            <div className="relative"><button onClick={() => setDropdownOpen((open) => !open)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--color-primary-border)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700 }}>{selectedIds.length} selected <ChevronDown size={14} /></button>{dropdownOpen && <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl p-1 shadow-xl" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>{selectablePeople.map((person) => { const selected = selectedIds.includes(person.id); return <button key={person.id} onClick={() => togglePerson(person.id)} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"><span className="rounded-full" style={{ width: 9, height: 9, background: person.id === 'you' ? 'var(--color-primary)' : colorForId(person.id) }} /><span className="flex-1" style={{ fontSize: 11, fontWeight: 600 }}>{person.name} {person.id === 'you' && <span style={{ color: '#94A3B8', fontWeight: 500 }}>(always)</span>}</span>{selected && <Check size={13} color="var(--color-primary)" />}</button> })}{friends.length === 0 && <div className="px-2.5 py-2" style={{ fontSize: 11, color: '#94A3B8' }}>You have no friends yet.</div>}</div>}</div>
            {selectedIds.length === 1 && <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 9 }}>Select friends to compare availability.</p>}
          </section>

          <section className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2 mb-3"><Clock3 size={15} color="#16A34A" /><b style={{ fontSize: 13 }}>Common free slots</b></div>
            <div className="flex flex-col gap-2" style={{ maxHeight: 430, overflowY: 'auto' }}>{freeSlots.length === 0 ? <div style={{ fontSize: 11, color: '#94A3B8' }}>No hourly common slots found.</div> : freeSlots.map((slot) => <div key={`${slot.day}-${slot.startH}`} className="rounded-xl px-3 py-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 11, color: '#15803D', fontWeight: 650 }}>{slot.day} · {formatH(slot.startH)} – {formatH(slot.endH)}</div>)}</div>
          </section>
        </aside>
      </div>
    )}
  </div>
}
