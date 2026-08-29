import test from 'node:test'
import assert from 'node:assert/strict'
import {
  linkColumn,
  linkGroupKey,
  removeCalendarSection,
  scheduleStats,
  uniqueSectionIds,
  type CalendarCourse,
} from './schedule.ts'

/**
 * Calendar-block fixtures. A single section renders one CalendarCourse entry
 * per meeting-day, all sharing the same sectionId (mirroring how the optimistic
 * and persisted-load paths map sections -> blocks).
 */
const block = (
  sectionId: number | null,
  code: string,
  credits: number,
  groupId?: string | null,
): CalendarCourse => ({ sectionId, code, credits, groupId })


const mwf = [
  block(123, 'CMPS 201', 3), // Monday
  block(123, 'CMPS 201', 3), // Wednesday
  block(123, 'CMPS 201', 3), // Friday
]

const ttr = [
  block(123, 'CMPS 201', 3), // Tuesday
  block(123, 'CMPS 201', 3), // Thursday
]

// TEST 1: A 3-credit MWF section creates 3 calendar blocks -> 1 course, 3 credits.
test('a 3-credit MWF section renders 3 blocks but counts as 1 course / 3 credits', () => {
  assert.equal(mwf.length, 3)
  assert.deepEqual(scheduleStats(mwf), { count: 1, credits: 3 })
})

// TEST 2: Deleting any one block removes all 3 blocks; section gone -> 0/0.
test('deleting one block from a MWF section removes every block of that section', () => {
  const remaining = removeCalendarSection(mwf, mwf[1])
  assert.deepEqual(remaining, [])
  assert.deepEqual(scheduleStats(remaining), { count: 0, credits: 0 })
})

// TEST 3: A TTR section with 2 blocks -> 1 course / 3 credits; delete either block removes both.
test('a TTR section with 2 blocks counts once and deleting either block removes both', () => {
  assert.equal(ttr.length, 2)
  assert.deepEqual(scheduleStats(ttr), { count: 1, credits: 3 })

  const withoutFirst = removeCalendarSection(ttr, ttr[0])
  const withoutSecond = removeCalendarSection(ttr, ttr[1])
  assert.deepEqual(withoutFirst, [])
  assert.deepEqual(withoutSecond, [])
})

// TEST 4: A single recitation/lab block -> 1 section / correct credits; delete removes it.
test('a single-block recitation/lab section counts once and removes cleanly on delete', () => {
  const recitation = [block(500, 'CMPS 202', 1)]
  assert.deepEqual(scheduleStats(recitation), { count: 1, credits: 1 })
  assert.deepEqual(removeCalendarSection(recitation, recitation[0]), [])
})

// TEST 5: Two different sections; deleting a CMPS 201 block leaves CMPS 211 untouched.
test('deleting a block from one section leaves the other section intact', () => {
  const both = [
    block(123, 'CMPS 201', 3), // CMPS 201 Mon
    block(123, 'CMPS 201', 3), // CMPS 201 Wed
    block(123, 'CMPS 201', 3), // CMPS 201 Fri
    block(456, 'CMPS 211', 3), // CMPS 211 Tue
    block(456, 'CMPS 211', 3), // CMPS 211 Thu
  ]

  const afterDelete = removeCalendarSection(both, both[0])
  assert.deepEqual(afterDelete, [block(456, 'CMPS 211', 3), block(456, 'CMPS 211', 3)])
  assert.deepEqual(scheduleStats(afterDelete), { count: 1, credits: 3 })
})

// TEST 6/7: Persistence identity — a multi-meeting section persists/loads as a single section.
test('multi-meeting sections map to a single unique persisted section id', () => {
  assert.deepEqual(uniqueSectionIds(mwf), [123])
  assert.deepEqual(uniqueSectionIds([]), [])

  // Simulates a persisted draft/schedule: one ScheduleCourse per section with all
  // its meetings, i.e. a set of blocks that all share the same sectionId.
  const loadedFromPersisted = [
    block(123, 'CMPS 201', 3), // Mon
    block(123, 'CMPS 201', 3), // Wed
    block(123, 'CMPS 201', 3), // Fri
    block(456, 'CMPS 211', 3), // Tue
    block(456, 'CMPS 211', 3), // Thu
  ]
  assert.deepEqual(scheduleStats(loadedFromPersisted), { count: 2, credits: 6 })
  assert.deepEqual(uniqueSectionIds(loadedFromPersisted), [123, 456])

  // Deleting one block of the loaded schedule deletes the whole section.
  const afterDelete = removeCalendarSection(loadedFromPersisted, loadedFromPersisted[1])
  assert.deepEqual(scheduleStats(afterDelete), { count: 1, credits: 3 })
  assert.deepEqual(uniqueSectionIds(afterDelete), [456])
})

// Distinct sections of the same course are distinguished by sectionId, not code.
test('multiple sections of the same course are distinguished by sectionId', () => {
  const twoSectionsOfSameCourse = [
    block(1, 'CMPS 201', 3), // Section 1, Mon
    block(1, 'CMPS 201', 3), // Section 1, Wed
    block(2, 'CMPS 201', 3), // Section 2, Mon
    block(2, 'CMPS 201', 3), // Section 2, Wed
  ]
  assert.deepEqual(scheduleStats(twoSectionsOfSameCourse), { count: 2, credits: 6 })
  const section1Only = removeCalendarSection(twoSectionsOfSameCourse, twoSectionsOfSameCourse[0])
  assert.deepEqual(scheduleStats(section1Only), { count: 1, credits: 3 })
})

// Linked lecture + recitation share a groupId -> count and delete as ONE course.
test('a linked lecture block and its recitation block count as one course', () => {
  const group = linkGroupKey('MATH 251', 'L1')!
  const lectureMwf = [
    block(910, 'MATH 251', 3, group),
    block(910, 'MATH 251', 3, group),
    block(910, 'MATH 251', 3, group),
  ]
  const recitation = [block(911, 'MATH 251', 3, linkGroupKey('MATH 251', 'E1'))]

  const bundle = [...lectureMwf, ...recitation]
  assert.equal(bundle.length, 4)
  assert.deepEqual(scheduleStats(bundle), { count: 1, credits: 3 })
  assert.deepEqual(uniqueSectionIds(bundle), [910, 911])
})

test('deleting any block deletes the whole linked lecture + recitation bundle', () => {
  const group = linkGroupKey('MATH 251', 'L1')!
  const bundle = [
    block(910, 'MATH 251', 3, group), // lecture Mon
    block(910, 'MATH 251', 3, group), // lecture Wed
    block(910, 'MATH 251', 3, group), // lecture Fri
    block(911, 'MATH 251', 3, linkGroupKey('MATH 251', 'E1')), // recitation
  ]
  const deletedFromRecitation = removeCalendarSection(bundle, bundle[3])
  assert.deepEqual(deletedFromRecitation, [])
  assert.deepEqual(scheduleStats(deletedFromRecitation), { count: 0, credits: 0 })
})

test('a standalone lecture (no link) counts as its own separate course', () => {
  const standalone = [
    block(910, 'MATH 251', 3), // no groupId
    block(911, 'MATH 251', 3, linkGroupKey('MATH 251', 'E1')), // linked recitation
  ]
  // The standalone lecture is one course; the linked recitation alone is another,
  // because its lecture pair is absent.
  assert.deepEqual(scheduleStats(standalone), { count: 2, credits: 6 })
})

test('linkColumn extracts the numeric column from AUB link_identifiers', () => {
  assert.equal(linkColumn('L1'), '1')
  assert.equal(linkColumn('E5'), '5')
  assert.equal(linkColumn('E12'), '12')
  assert.equal(linkColumn(null), null)
  assert.equal(linkColumn(undefined), null)
  assert.equal(linkGroupKey('MATH 251', 'E5'), 'linked:MATH 251:5')
  assert.equal(linkGroupKey('MATH 251', null), null)
})
