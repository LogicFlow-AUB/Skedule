export type TermOption = { id: number; name: string; code?: string; description?: string; start_date?: string; end_date?: string }

/** Human-readable label for a term: the AUB description, else the code, else the name. */
export function termLabel(term: Pick<TermOption, 'description' | 'code' | 'name'>): string {
  return term.description || term.code || term.name
}
export type AttributeOption = { id: number; name: string }
export type ProfessorOption = { id: number; first_name: string; last_name: string }
export type CourseOption = { id: number; code: string; title: string; credits: number; professors: ProfessorOption[] }

export type OptimizeScheduleRequest = {
  request_id?: string
  term_id: number
  required_course_ids: number[]
  acceptable_elective_course_ids: number[]
  attribute_ids: number[]
  min_credits: number
  max_credits: number
  weights: { days: number; gaps: number; professor: number }
  professor_preferences?: Record<string, number>
  excluded_section_ids?: number[]
  max_occurrences_per_day?: number
}

export type OptimizerMeeting = {
  day: 'M' | 'T' | 'W' | 'R' | 'F' | 'S' | 'U'
  start: string
  end: string
  building?: string
  room?: string
}

export type SelectedSection = {
  id: number | string
  course_id: number | string
  crn?: string
  section_number?: string
  course_code?: string
  course_title?: string
  credits?: number
  component_type?: 'lecture' | 'recitation' | 'lab' | string
  professor?: ProfessorOption
  campus?: string
  room?: string
  start_date?: string
  end_date?: string
  meetings: OptimizerMeeting[]
}

export type OptimizeScheduleResult = {
  status: 'optimal' | 'infeasible' | 'not_solved' | string
  request_id?: string
  selected_course_ids: string[]
  selected_section_ids: string[]
  selected_section_component_ids: Record<string, string[]>
  selected_courses: unknown[]
  selected_sections: SelectedSection[]
  total_credits?: number
  campus_days?: number
  weekly_largest_gaps_sum_minutes?: number
  weekly_first_to_last_spans_sum_minutes?: number
  professor_preference_penalty?: number
  days?: Record<string, unknown>
  message?: string
  diagnostics?: Record<string, unknown>
}

export type OptimizerFormState = {
  termId: number | null
  requiredCourses: CourseOption[]
  acceptableElectives: CourseOption[]
  selectedAttributeIds: number[]
  creditMode: 'exact' | 'range'
  exactCredits: number
  minCredits: number
  maxCredits: number
  weights: { days: number; gaps: number; professor: number }
  professorPreferences: Record<string, number>
  excludedSectionIds: number[]
  maxOccurrencesPerDay?: number
}

export const OPTIMIZER_DAY_INDEX = { M: 0, T: 1, W: 2, R: 3, F: 4, S: 5, U: 6 } as const

export function buildOptimizeRequest(state: OptimizerFormState): OptimizeScheduleRequest {
  if (state.termId == null) throw new Error('Select a planning term.')
  const requiredIds = state.requiredCourses.map((course) => course.id)
  const electiveIds = state.acceptableElectives.map((course) => course.id)
  if (new Set(requiredIds).size !== requiredIds.length || new Set(electiveIds).size !== electiveIds.length) throw new Error('A course may only be selected once.')
  if (requiredIds.some((id) => electiveIds.includes(id))) throw new Error('A course cannot be both required and elective.')
  if ([...state.requiredCourses, ...state.acceptableElectives].some((course) => !Number.isFinite(course.credits) || course.credits < 0)) throw new Error('Course credits are invalid.')
  const minCredits = state.creditMode === 'exact' ? state.exactCredits : state.minCredits
  const maxCredits = state.creditMode === 'exact' ? state.exactCredits : state.maxCredits
  if (!Number.isFinite(minCredits) || !Number.isFinite(maxCredits) || minCredits < 0 || maxCredits < 0) throw new Error('Enter a valid credit load.')
  if (minCredits > maxCredits) throw new Error('Minimum credits cannot exceed maximum credits.')
  if (state.requiredCourses.reduce((sum, course) => sum + course.credits, 0) > maxCredits) throw new Error('Required-course credits exceed the maximum credit load.')
  if (Object.values(state.professorPreferences).some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error('Professor ratings must be from 1 to 5.')
  if (Object.values(state.weights).some((weight) => !Number.isFinite(weight) || weight < 0) || Object.values(state.weights).reduce((sum, weight) => sum + weight, 0) !== 100) throw new Error('Priority weights must total 100%.')
  return {
    request_id: crypto.randomUUID(), term_id: state.termId, required_course_ids: requiredIds,
    acceptable_elective_course_ids: electiveIds, attribute_ids: state.selectedAttributeIds,
    min_credits: minCredits, max_credits: maxCredits, weights: state.weights,
    professor_preferences: state.professorPreferences, excluded_section_ids: state.excludedSectionIds,
    ...(state.maxOccurrencesPerDay == null ? {} : { max_occurrences_per_day: state.maxOccurrencesPerDay }),
  }
}

/**
 * Render an OptimizeScheduleRequest as a self-describing natural-language
 * request that the existing assistant router can route to the optimizer route
 * and whose extraction step can recover the exact selected preferences. The
 * optimizer route's extraction treats explicit numeric ids (courses, attributes,
 * professors, term, sections) as pass-through values, so the user's exact
 * selections survive the round-trip rather than being re-guessed.
 */
export function buildOptimizerPrompt(request: OptimizeScheduleRequest): string {
  const lines: string[] = [`Please generate an optimal schedule for term id ${request.term_id}.`]
  if (request.required_course_ids.length > 0) {
    lines.push(`Required course ids: ${request.required_course_ids.join(', ')}.`)
  }
  if (request.acceptable_elective_course_ids.length > 0) {
    lines.push(`Acceptable elective course ids: ${request.acceptable_elective_course_ids.join(', ')}.`)
  }
  if (request.attribute_ids.length > 0) {
    lines.push(`Required attribute ids: ${request.attribute_ids.join(', ')}.`)
  }
  if (request.min_credits === request.max_credits) {
    lines.push(`Target credits: exactly ${request.min_credits}.`)
  } else {
    lines.push(`Target credits: at least ${request.min_credits} and at most ${request.max_credits}.`)
  }
  lines.push(
    `Priority weights: days ${request.weights.days}, gaps ${request.weights.gaps}, professor ${request.weights.professor}.`,
  )
  const prefs = Object.entries(request.professor_preferences ?? {})
  if (prefs.length > 0) {
    lines.push(`Professor preferences: ${prefs.map(([id, score]) => `professor id ${id}: preference ${score}`).join(', ')}.`)
  }
  if (request.excluded_section_ids && request.excluded_section_ids.length > 0) {
    lines.push(`Excluded section ids: ${request.excluded_section_ids.join(', ')}.`)
  }
  if (request.max_occurrences_per_day != null) {
    lines.push(`At most ${request.max_occurrences_per_day} classes per day.`)
  }
  return lines.join('\n')
}

export function validateOptimizerResult(result: OptimizeScheduleResult) {
  const components = new Map<string, Set<string>>()
  for (const section of result.selected_sections ?? []) {
    const key = String(section.course_id)
    const values = components.get(key) ?? new Set<string>()
    values.add((section.component_type ?? '').toLowerCase())
    components.set(key, values)
  }
  for (const values of components.values()) {
    if (values.has('recitation') && values.has('lab')) throw new Error('The optimizer returned both a recitation and a lab for one course. This is a backend/data-integrity issue.')
  }
}

export function optimizerMeetingOccurrences(sections: SelectedSection[]) {
  return sections.flatMap((section) => section.meetings.map((meeting, meetingIndex) => ({
    key: `${section.id}-${meetingIndex}`,
    section,
    meeting,
    dayIndex: OPTIMIZER_DAY_INDEX[meeting.day],
  })))
}
