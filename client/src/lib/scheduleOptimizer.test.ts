import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOptimizeRequest, buildOptimizerPrompt, onlineOptimizerSections, optimizerMeetingOccurrences, validateOptimizerResult, type OptimizerFormState, type SelectedSection } from './scheduleOptimizer.ts'

const course = (id: number, credits = 3) => ({ id, code: `C ${id}`, title: 'Course', credits, professors: [{ id: 45, first_name: 'A', last_name: 'B' }] })
const form = (overrides: Partial<OptimizerFormState> = {}): OptimizerFormState => ({ termId: 3, requiredCourses: [course(101)], acceptableElectives: [course(207)], selectedAttributeIds: [12], creditMode: 'exact', exactCredits: 15, minCredits: 12, maxCredits: 18, weights: { days: 35, gaps: 40, professor: 25 }, professorPreferences: { '45': 5 }, excludedSectionIds: [], ...overrides })

test('exact requests use numeric IDs, numeric backend credits, professor IDs, and snake_case fields', () => {
  const request = buildOptimizeRequest(form())
  assert.equal(request.term_id, 3); assert.deepEqual(request.required_course_ids, [101]); assert.deepEqual(request.acceptable_elective_course_ids, [207]); assert.deepEqual(request.attribute_ids, [12]); assert.equal(request.min_credits, 15); assert.equal(request.max_credits, 15); assert.deepEqual(request.weights, { days: 35, gaps: 40, professor: 25 }); assert.deepEqual(request.professor_preferences, { '45': 5 })
})

test('range requests retain both credit bounds', () => {
  const request = buildOptimizeRequest(form({ creditMode: 'range', minCredits: 14, maxCredits: 17 }))
  assert.equal(request.min_credits, 14); assert.equal(request.max_credits, 17)
})

test('optimizer prompt encodes exact selections with numeric ids for the assistant route', () => {
  const prompt = buildOptimizerPrompt(buildOptimizeRequest(form()))
  assert.match(prompt, /term id 3/)
  assert.match(prompt, /Required course ids: 101/)
  assert.match(prompt, /elective course ids: 207/)
  assert.match(prompt, /attribute ids: 12/)
  assert.match(prompt, /exactly 15/)
  assert.match(prompt, /days 35, gaps 40, professor 25/)
  assert.match(prompt, /professor id 45: preference 5/)
})

test('validation rejects overlapping courses and invalid weights', () => {
  assert.throws(() => buildOptimizeRequest(form({ acceptableElectives: [course(101)] })), /both required and elective/)
  assert.throws(() => buildOptimizeRequest(form({ weights: { days: 20, gaps: 20, professor: 20 } })), /total 100/)
})

const section = (id: number, component_type: string, meetings: SelectedSection['meetings']): SelectedSection => ({ id, course_id: 101, component_type, meetings })
test('every returned meeting becomes one occurrence and online sections stay out of the calendar', () => {
  const sections = [section(1, 'lecture', [{ day: 'M', start: '09:00', end: '10:00' }, { day: 'W', start: '09:00', end: '10:00' }]), section(2, 'lab', [] as SelectedSection['meetings'])]
  assert.equal(optimizerMeetingOccurrences(sections).length, 2); assert.deepEqual(optimizerMeetingOccurrences(sections).map((item) => item.dayIndex), [0, 2]); assert.deepEqual(onlineOptimizerSections(sections).map((item) => item.id), [2])
})

test('lecture plus recitation/lab is accepted but recitation plus lab is reported', () => {
  const result = (sections: SelectedSection[]) => ({ status: 'optimal', selected_course_ids: [], selected_section_ids: [], selected_section_component_ids: {}, selected_courses: [], selected_sections: sections })
  assert.doesNotThrow(() => validateOptimizerResult(result([section(1, 'lecture', []), section(2, 'recitation', [])])))
  assert.doesNotThrow(() => validateOptimizerResult(result([section(1, 'lecture', []), section(2, 'lab', [])])))
  assert.throws(() => validateOptimizerResult(result([section(1, 'lecture', []), section(2, 'recitation', []), section(3, 'lab', [])])), /data-integrity/)
})
