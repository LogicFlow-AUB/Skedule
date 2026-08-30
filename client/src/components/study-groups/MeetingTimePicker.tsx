import { Clock3 } from 'lucide-react'
import { formatTime } from '../../data/studyGroups'

type Props = {
  startTime: string | null
  endTime: string | null
  onChange: (startTime: string | null, endTime: string | null) => void
}

/** Build the half-hour time slots offered in each dropdown (00:00 → 23:30). */
function timeSlots(): string[] {
  const slots: string[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
  }
  return slots
}

const SLOTS = timeSlots()

/**
 * Build the dropdown options for one time slot. Always includes the currently
 * selected value (even if it is off the half-hour grid, e.g. a stored 10:45),
 * followed by the standard half-hour slots.
 */
function slotOptions(current: string | null): { value: string; label: string }[] {
  const options = SLOTS.map((value) => ({ value, label: formatTime(value) }))
  if (current) {
    const exists = options.some((option) => option.value === current)
    if (!exists) {
      options.unshift({ value: current, label: formatTime(current) })
      options.sort((a, b) => a.value.localeCompare(b.value))
    }
  }
  return options
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  color: '#1E293B',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  padding: '9px 10px',
  outline: 'none',
  fontWeight: 600,
}

export default function MeetingTimePicker({ startTime, endTime, onChange }: Props) {
  const start = startTime ?? null
  const end = endTime ?? null

  return (
    <div>
      <div className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 5 }}>
        <Clock3 size={12} color="#6366F1" />
        <span>Meeting time</span>
        <span style={{ color: '#94A3B8', fontWeight: 500 }}>(optional)</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="mt-start" style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Start time</label>
          <select
            id="mt-start"
            value={start ?? ''}
            onChange={(event) => onChange(event.target.value || null, end)}
            style={selectStyle}
          >
            <option value="">No time</option>
            {slotOptions(start).filter((option) => option.value !== end).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mt-end" style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>End time</label>
          <select
            id="mt-end"
            value={end ?? ''}
            onChange={(event) => onChange(start, event.target.value || null)}
            style={selectStyle}
          >
            <option value="">No time</option>
            {slotOptions(end).filter((option) => option.value !== start).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      {!start && !end && (
        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 7, fontStyle: 'italic' }}>
          Pick a time range, or leave it blank if the meeting time is&nbsp;to be announced.
        </p>
      )}
    </div>
  )
}
