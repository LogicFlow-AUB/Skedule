import { useMemo, useState } from 'react'
import { Check, ChevronDown, Clock3, Users } from 'lucide-react'

interface BusyInterval { day: number; startH: number; endH: number }
interface AvailabilityPerson { id: string; name: string; color: string; schedule: BusyInterval[] }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const GRID_START = 7
const GRID_END = 21
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, index) => GRID_START + index)

// TODO(frontend): Replace mock availability data with real user/friend schedules when backend support is implemented.
const PEOPLE: AvailabilityPerson[] = [
  { id: 'you', name: 'You', color: 'var(--color-primary)', schedule: [{ day: 0, startH: 9, endH: 12 }, { day: 0, startH: 14, endH: 16 }, { day: 1, startH: 10, endH: 13 }, { day: 2, startH: 9, endH: 11 }, { day: 3, startH: 12, endH: 15 }, { day: 4, startH: 10, endH: 12 }] },
  { id: 'sarah', name: 'Sarah K.', color: '#059669', schedule: [{ day: 0, startH: 10, endH: 13 }, { day: 1, startH: 8, endH: 11 }, { day: 2, startH: 13, endH: 16 }, { day: 3, startH: 9, endH: 12 }, { day: 4, startH: 14, endH: 17 }] },
  { id: 'karim', name: 'Karim A.', color: '#0284C7', schedule: [{ day: 0, startH: 13, endH: 16 }, { day: 1, startH: 11, endH: 14 }, { day: 2, startH: 8, endH: 10 }, { day: 3, startH: 15, endH: 18 }, { day: 4, startH: 9, endH: 11 }] },
  { id: 'lara', name: 'Lara M.', color: '#7C3AED', schedule: [{ day: 0, startH: 8, endH: 10 }, { day: 1, startH: 14, endH: 17 }, { day: 2, startH: 10, endH: 13 }, { day: 3, startH: 8, endH: 11 }, { day: 4, startH: 12, endH: 15 }] },
  { id: 'nour', name: 'Nour H.', color: '#D97706', schedule: [{ day: 0, startH: 15, endH: 18 }, { day: 1, startH: 9, endH: 12 }, { day: 2, startH: 14, endH: 17 }, { day: 3, startH: 10, endH: 13 }, { day: 4, startH: 8, endH: 10 }] },
  { id: 'ziad', name: 'Ziad T.', color: '#0EA5E9', schedule: [{ day: 0, startH: 11, endH: 14 }, { day: 1, startH: 15, endH: 18 }, { day: 2, startH: 9, endH: 12 }, { day: 3, startH: 13, endH: 16 }, { day: 4, startH: 11, endH: 14 }] },
]

function formatH(hour: number) {
  if (hour === 12) return '12:00 PM'
  if (hour > 12) return `${hour - 12}:00 PM`
  return `${hour}:00 AM`
}

function isBusy(person: AvailabilityPerson, day: number, hour: number) {
  return person.schedule.some((interval) => interval.day === day && interval.startH < hour + 1 && interval.endH > hour)
}

function getCommonFreeSlots(people: AvailabilityPerson[]) {
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
  const [selectedIds, setSelectedIds] = useState(['you'])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const selectedPeople = useMemo(() => PEOPLE.filter((person) => selectedIds.includes(person.id)), [selectedIds])
  const freeSlots = useMemo(() => getCommonFreeSlots(selectedPeople), [selectedPeople])

  const togglePerson = (id: string) => {
    if (id === 'you') return
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  return <div className="h-full overflow-auto" style={{ background: '#F8FAFC' }}>
    <header className="px-8 py-5" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 5 }}>Smart Schedule <span style={{ margin: '0 5px' }}>›</span> Common Free Time</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A' }}>Common Free Time</h1>
      <p style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Find overlapping free time with your friends.</p>
    </header>

    <div className="p-6 grid gap-5 items-start" style={{ gridTemplateColumns: 'minmax(680px, 1fr) 300px' }}>
      <section className="rounded-2xl overflow-hidden min-w-0" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div><div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Weekly availability</div><div style={{ fontSize: 11, color: '#94A3B8' }}>Hourly view · 7:00 AM–9:00 PM</div></div>
          <div className="flex flex-wrap gap-3">{selectedPeople.map((person) => <div key={person.id} className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#475569' }}><span className="rounded-full" style={{ width: 8, height: 8, background: person.color }} />{person.name}</div>)}<div className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#15803D' }}><span className="rounded-full" style={{ width: 8, height: 8, background: '#22C55E' }} />All free</div></div>
        </div>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 680 }}>
            <div className="grid" style={{ gridTemplateColumns: '80px repeat(5, minmax(110px, 1fr))' }}><div /><>{DAYS.map((day) => <div key={day} className="py-3 text-center" style={{ fontSize: 12, fontWeight: 700, color: '#475569', borderLeft: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>{day}</div>)}</></div>
            {HOURS.map((hour) => <div key={hour} className="grid" style={{ gridTemplateColumns: '80px repeat(5, minmax(110px, 1fr))' }}>
              <div className="pr-3 pt-2 text-right" style={{ height: 48, fontSize: 10, color: '#94A3B8', borderBottom: '1px solid #F8FAFC' }}>{formatH(hour)}</div>
              {DAYS.map((_, day) => { const busy = selectedPeople.filter((person) => isBusy(person, day, hour)); const allFree = busy.length === 0; const background = allFree ? '#F0FDF4' : busy.length === 1 ? `${busy[0].color}18` : `repeating-linear-gradient(135deg, ${busy[0].color}18 0 8px, ${busy[1].color}18 8px 16px)`; return <div key={day} title={allFree ? 'Everyone is free' : `Busy: ${busy.map((person) => person.name).join(', ')}`} className="px-2 py-1.5 overflow-hidden" style={{ height: 48, background, borderLeft: `1px solid ${allFree ? '#BBF7D0' : '#F1F5F9'}`, borderBottom: `1px solid ${allFree ? '#BBF7D0' : '#F1F5F9'}` }}>{allFree ? <span style={{ fontSize: 9, fontWeight: 700, color: '#16A34A' }}>Free</span> : <span className="block truncate" style={{ fontSize: 9, color: '#64748B' }}>{busy.map((person) => person.name).join(', ')}</span>}</div> })}
            </div>)}
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <section className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2 mb-3"><Users size={15} color="var(--color-primary)" /><b style={{ fontSize: 13 }}>Compare with friends</b></div>
          <div className="relative"><button onClick={() => setDropdownOpen((open) => !open)} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--color-primary-border)', background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontSize: 12, fontWeight: 700 }}>{selectedIds.length} selected <ChevronDown size={14} /></button>{dropdownOpen && <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl p-1 shadow-xl" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>{PEOPLE.map((person) => { const selected = selectedIds.includes(person.id); return <button key={person.id} onClick={() => togglePerson(person.id)} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"><span className="rounded-full" style={{ width: 9, height: 9, background: person.color }} /><span className="flex-1" style={{ fontSize: 11, fontWeight: 600 }}>{person.name} {person.id === 'you' && <span style={{ color: '#94A3B8', fontWeight: 500 }}>(always)</span>}</span>{selected && <Check size={13} color="var(--color-primary)" />}</button> })}</div>}</div>
          {selectedIds.length === 1 && <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 9 }}>Select friends to compare availability.</p>}
        </section>

        <section className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2 mb-3"><Clock3 size={15} color="#16A34A" /><b style={{ fontSize: 13 }}>Common free slots</b></div>
          <div className="flex flex-col gap-2" style={{ maxHeight: 430, overflowY: 'auto' }}>{freeSlots.length === 0 ? <div style={{ fontSize: 11, color: '#94A3B8' }}>No hourly common slots found.</div> : freeSlots.map((slot) => <div key={`${slot.day}-${slot.startH}`} className="rounded-xl px-3 py-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 11, color: '#15803D', fontWeight: 650 }}>{slot.day} · {formatH(slot.startH)} – {formatH(slot.endH)}</div>)}</div>
        </section>
      </aside>
    </div>
  </div>
}
