/**
 * Pure helpers for calendar-block <-> section logic shared by the calendar
 * builders.
 *
 * A single course section can render as multiple calendar meeting blocks (a MWF
 * section renders three blocks, a TTR section two, a recitation/lab one). These
 * helpers make every operation (counting, deletion, deduping) operate on the
 * canonical section identity rather than on individual calendar blocks.
 */

export interface CalendarCourse {
  sectionId: number | null
  code: string
  credits: number
  /**
   * Identity shared by every calendar block that belongs to the same linked
   * section bundle (e.g. a lecture and its chosen recitation/lab). Linked
   * components of one AUB section column share a `link_identifier`, so tagging
   * all of their blocks with the same group key makes them count and delete as
   * a single course.
   */
  groupId?: string | null
}

/** True when the course block represents a linked section component. */
export function isLinked(course: CalendarCourse): boolean {
  return course.groupId != null && course.groupId.length > 0
}

/**
 * Extracts the numeric column from an AUB ``link_identifier`` (``L1``/``E5`` ->
 * ``1``/``5``). Linked components of one section column share this number even
 * though the letters differ (lectures use ``L``, recitations/labs ``E``).
 */
export function linkColumn(linkIdentifier: string | null | undefined): string | null {
  if (!linkIdentifier) return null
  const match = String(linkIdentifier).match(/\d+/)
  return match ? match[0] : String(linkIdentifier)
}

/** Builds the shared group key for a linked section column of a course. */
export function linkGroupKey(
  code: string,
  linkIdentifier: string | null | undefined,
): string | null {
  const column = linkColumn(linkIdentifier)
  return column != null ? `linked:${code}:${column}` : null
}

/** The canonical identity of a course/section selection. */
export function sectionKey(course: CalendarCourse): string {
  if (course.groupId != null && course.groupId.length > 0) return `group:${course.groupId}`
  return course.sectionId != null ? `section:${course.sectionId}` : `code:${course.code}`
}

/**
 * Counts the uniquely selected sections/courses and their total credits,
 * regardless of how many calendar meeting blocks each section renders. A MWF
 * section that produces three calendar blocks still counts as exactly one
 * course with one credit total. A lecture block and its linked recitation/lab
 * block that share a groupId count as one course.
 */
export function scheduleStats(courses: CalendarCourse[]): {
  count: number
  credits: number
} {
  const unique = new Map<string, CalendarCourse>()
  for (const course of courses) {
    unique.set(sectionKey(course), course)
  }

  let credits = 0
  for (const course of unique.values()) {
    credits += course.credits
  }

  return { count: unique.size, credits }
}

/**
 * Deletes an entire section: every calendar block belonging to the same section
 * as `target` (matched by groupId, then sectionId, falling back to the course
 * code) is removed. All legitimate meeting blocks of that section — including a
 * lecture's linked recitation/lab blocks in the same group — disappear together.
 */
export function removeCalendarSection<T extends CalendarCourse>(
  courses: T[],
  target: CalendarCourse,
): T[] {
  const key = sectionKey(target)
  return courses.filter((course) => sectionKey(course) !== key)
}

/** Returns the unique section identities present in the given courses. */
export function uniqueSectionIds(courses: CalendarCourse[]): number[] {
  return [
    ...new Set(
      courses
        .map((course) => course.sectionId)
        .filter((sectionId): sectionId is number => sectionId != null),
    ),
  ]
}
