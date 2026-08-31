import config from '../config.js';
import { requireSupabaseClient } from '../db/supabase.js';
import { logger } from '../utils/logger.js';
import { fetchAllSections, getTerms } from './aub-registration.service.js';
import type { AubMeetingTime, AubSection, AubTerm } from './aub-registration.service.js';
import { sortTermsNewestFirst, termsInSyncWindow, SYNC_TERM_WINDOW } from './term-window.js';

let syncTimer: ReturnType<typeof setInterval> | undefined;
let syncing = false;
let loggedRawCreditSample = false;

// ── helpers ──────────────────────────────────────────────────────────

function parseTime(time: string | null): string | null {
  if (!time || time.length < 4) return null;
  const h = time.slice(0, 2);
  const m = time.slice(2, 4);
  return `${h}:${m}:00`;
}

function buildDaysString(mt: AubMeetingTime | null): string | null {
  if (!mt) return null;
  const days: string[] = [];
  if (mt.monday) days.push('M');
  if (mt.tuesday) days.push('T');
  if (mt.wednesday) days.push('W');
  if (mt.thursday) days.push('R');
  if (mt.friday) days.push('F');
  if (mt.saturday) days.push('S');
  if (mt.sunday) days.push('U');
  return days.length > 0 ? days.join('') : null;
}

function parseAubDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts;
  if (!mm || !dd || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Returns a numeric credit string, or null when no credible value exists. */
function creditString(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  const t = v.trim();
  if (t === '') return null;
  return Number.isNaN(Number(t)) ? null : t;
}

/**
 * Resolves a section's credit figure from the several places Banner reports it.
 * `creditHourLow` / `creditHourHigh` carry the section-level credit range,
 * `creditHours` is the top-level shorthand, and `creditHourSession` lives on
 * each meeting time. For split/component sections (e.g. a 3-credit course whose
 * top-level low/high report only one component) these can disagree, so we take
 * the MAXIMUM of every signal — the lecture/session figure normally carries the
 * full course credits, which fixes under-reporting without needing a hardcoded
 * preference order.
 */
function resolveAubCredits(aub: AubSection): string | null {
  const candidates = [
    creditString(aub.creditHours),
    creditString(aub.creditHourHigh),
    creditString(aub.creditHourLow),
    ...(aub.meetingsFaculty ?? []).map((mf) =>
      creditString(mf.meetingTime?.creditHourSession),
    ),
  ];
  let max: string | null = null;
  for (const c of candidates) {
    if (c === null) continue;
    max = max === null ? c : maxCreditString(max, c);
  }
  return max;
}

/** Returns the larger of two numeric credit strings (null-safe). */
function maxCreditString(a: string, b: string | null): string {
  if (b === null) return a;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isNaN(na)) return b;
  if (Number.isNaN(nb)) return a;
  return na >= nb ? a : b;
}

function parseName(displayName: string | undefined): { firstName: string; lastName: string } {
  if (!displayName) return { firstName: 'Unknown', lastName: 'Unknown' };
  const parts = displayName.split(', ');
  if (parts.length >= 2) {
    return { firstName: parts[1]?.trim() ?? 'Unknown', lastName: parts[0]?.trim() ?? 'Unknown' };
  }
  return { firstName: displayName.trim(), lastName: '' };
}

// ── sync ─────────────────────────────────────────────────────────────

type TermRow = { id: number; name: string; code: string; description: string | null };
type CourseRow = { id: number; subject: string; course_number: string };
type ProfRow = { id: number; first_name: string; last_name: string };
type SectionRow = { id: number; term_id: number; crn: string };
type AttrRow = { id: number; name: string };

async function syncAubData(): Promise<void> {
  if (syncing) {
    logger.warn('AUB sync: skipped – already running');
    return;
  }
  syncing = true;
  const start = Date.now();
  logger.info('AUB sync: starting');

  try {
    const db = requireSupabaseClient();

    // Fetch every term AUB currently exposes (max 15), then upsert them. A
    // failure in one term is logged and skipped so the rest still complete (no
    // single bad term takes down the whole run).
    const availableTerms = await getTerms();
    if (availableTerms.length === 0) {
      logger.warn('AUB sync: no terms returned from AUB, nothing to sync');
      return;
    }

    // Keep only academic terms (drop Clubs/activity and Online semesters),
    // newest-first by numeric code, so the term selector can offer them all.
    const eligibleTerms = sortTermsNewestFirst(availableTerms);
    if (eligibleTerms.length === 0) {
      logger.warn('AUB sync: no academic terms after filtering clubs/online, nothing to sync');
      return;
    }

    const terms: TermRow[] = [];
    for (const aubTerm of eligibleTerms) {
      terms.push(await ensureTerm(db, aubTerm));
    }
    logger.info(
      { available: availableTerms.length, eligible: terms.length },
      'AUB sync: terms ready',
    );

    // Only the most recent `SYNC_TERM_WINDOW` academic terms have their sections
    // fetched/synced; older/frozen terms keep whatever data they already have.
    const syncCodes = new Set(termsInSyncWindow(eligibleTerms).map((t) => t.code));
    logger.info(
      {
        eligible: terms.length,
        syncing: syncCodes.size,
        codes: Array.from(syncCodes),
      },
      `AUB sync: syncing sections for up to ${SYNC_TERM_WINDOW} newest terms`,
    );

    let synced = 0;
    for (const term of terms) {
      if (!syncCodes.has(term.code)) {
        logger.info({ termCode: term.code }, 'AUB sync: outside window, skipping section sync');
        continue;
      }
      const termStart = Date.now();
      try {
        const aubSections = await fetchAllSections(term.code);
        if (aubSections.length === 0) {
          logger.warn({ termId: term.id, termCode: term.code }, 'AUB sync: no sections for term');
          continue;
        }
        await syncTermData(term, aubSections);
        synced += 1;
        const elapsed = ((Date.now() - termStart) / 1000).toFixed(1);
        logger.info({ termId: term.id, termCode: term.code, elapsed }, 'AUB sync: term synced');
      } catch (err) {
        const elapsed = ((Date.now() - termStart) / 1000).toFixed(1);
        logger.error(
          { err, termCode: term.code, elapsed },
          'AUB sync: term sync failed, continuing',
        );
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info({ terms: terms.length, synced, elapsed }, 'AUB sync: completed');
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.error({ err, elapsed }, 'AUB sync: failed');
  } finally {
    syncing = false;
  }
}

/** Upserts a term (keyed by its external AUB code) and returns the DB row id. */
async function ensureTerm(
  db: ReturnType<typeof requireSupabaseClient>,
  aubTerm: AubTerm,
): Promise<TermRow> {
  const { data, error } = await db
    .from('terms')
    .select('id, name')
    .eq('code', aubTerm.code)
    .maybeSingle();
  if (error) throw error;

  const now = new Date().toISOString();
  if (data) {
    const existing = data as { id: number; name: string };
    // Refresh the human-readable label and keep `name` mirrored to the code for
    // back-compat with consumers that still read `terms.name`.
    await db
      .from('terms')
      .update({ name: aubTerm.code, description: aubTerm.description, updated_at: now })
      .eq('id', existing.id);
    return {
      id: existing.id,
      name: aubTerm.code,
      code: aubTerm.code,
      description: aubTerm.description,
    };
  }

  const { data: inserted, error: insertErr } = await db
    .from('terms')
    .insert({
      name: aubTerm.code,
      code: aubTerm.code,
      description: aubTerm.description,
      start_date: null,
      end_date: null,
    })
    .select('id, name')
    .single();
  if (insertErr) throw insertErr;
  const row = inserted as { id: number; name: string };
  logger.info({ termId: row.id, termCode: aubTerm.code }, 'AUB sync: created term');
  return {
    id: row.id,
    name: aubTerm.code,
    code: aubTerm.code,
    description: aubTerm.description,
  };
}

async function syncTermData(term: TermRow, aubSections: AubSection[]): Promise<void> {
  const db = requireSupabaseClient();

  try {
    // ── load existing data ─────────────────────────────────────────
    const [coursesRes, profsRes, sectionsRes, attrsRes] = await Promise.all([
    db.from('courses').select('id, subject, course_number').limit(10000),
    db.from('professors').select('id, first_name, last_name').limit(10000),
    db.from('sections').select('id, term_id, crn').limit(10000),
    db.from('attributes').select('id, name').limit(10000),
  ]);

  if (coursesRes.error) throw coursesRes.error;
  if (profsRes.error) throw profsRes.error;
  if (sectionsRes.error) throw sectionsRes.error;
  if (attrsRes.error) throw attrsRes.error;

  const existingCourses = (coursesRes.data ?? []) as CourseRow[];
  const existingProfs = (profsRes.data ?? []) as ProfRow[];
  const existingSections = (sectionsRes.data ?? []) as SectionRow[];
  const existingAttrs = (attrsRes.data ?? []) as AttrRow[];

  // ── collect unique entities from AUB data ──────────────────────
    const courseMap = new Map<string, CourseRow>();
    for (const c of existingCourses) courseMap.set(`${c.subject}|${c.course_number}`, c);

    const profMap = new Map<string, ProfRow>();
    for (const p of existingProfs) profMap.set(`${p.first_name}|${p.last_name}`, p);

    const attrMap = new Map<string, AttrRow>();
    for (const a of existingAttrs) attrMap.set(a.name, a);

    const sectionMap = new Map<string, SectionRow>();
    for (const s of existingSections) sectionMap.set(`${s.term_id}|${s.crn}`, s);

    // Split every unique fetched course into ones that are new (must insert) and
    // ones that already exist (may update). New courses always get a non-null
    // credits value (AUB's, or `'0'`), so the NOT NULL constraint is never hit.
    // Existing courses are only written when AUB actually reports credits, so a
    // real/known figure is refreshed without ever sending a null (which the
    // client would otherwise emit for `undefined`) and without regressing a
    // good value back to '0'. Courses are never deleted; only refreshed.
    // Aggregate credits across ALL of a course's sections. AUB often splits a
    // course into multiple components (lecture + lab/recitation, each its own
    // section reporting partial credits), and every section also re-reports the
    // same top-level credit fields. Taking only the first section can under-
    // report (e.g. a 2-credit lecture whose 3-credit course total includes a
    // 1-credit lab), so we keep the MAXIMUM resolved value and the best title.
    const courseCredits = new Map<string, { credits: string | null; title: string }>();
    for (const aub of aubSections) {
      const key = `${aub.subject}|${aub.courseNumber}`;
      const credits = resolveAubCredits(aub);
      const entry = courseCredits.get(key);
      const max =
        entry && entry.credits !== null
          ? maxCreditString(entry.credits, credits)
          : credits;
      courseCredits.set(key, {
        credits: max,
        title: entry && entry.title !== '' ? entry.title : aub.courseTitle,
      });
    }

    const newCourses: Array<{
      subject: string;
      course_number: string;
      title: string;
      credits: string;
    }> = [];
    const updateCourses: Array<{
      subject: string;
      course_number: string;
      title: string;
      credits: string;
    }> = [];
    for (const [key, { credits, title }] of courseCredits) {
      const keyParts = key.split('|');
      const subject = keyParts[0] ?? '';
      const course_number = keyParts[1] ?? '';

      if (!courseMap.has(key)) {
        if (credits === null && !loggedRawCreditSample) {
          loggedRawCreditSample = true;
          logger.info(
            { subject, courseNumber: course_number },
            'AUB sync: no credits resolvable for a course (first sample; safe fallback to 0)',
          );
        }
        newCourses.push({
          subject,
          course_number,
          title,
          credits: credits ?? '0',
        });
      } else if (credits !== null) {
        updateCourses.push({
          subject,
          course_number,
          title,
          credits,
        });
      }
    }

    // collect unique new professors
    const newProfs: Array<{ first_name: string; last_name: string }> = [];
    for (const aub of aubSections) {
      const fac = aub.faculty?.[0];
      if (!fac) continue;
      const { firstName, lastName } = parseName(fac.displayName);
      const key = `${firstName}|${lastName}`;
      if (!profMap.has(key) && !newProfs.find((p) => `${p.first_name}|${p.last_name}` === key)) {
        newProfs.push({ first_name: firstName, last_name: lastName });
      }
    }

    // collect unique new attributes
    const newAttrs: Array<{ name: string }> = [];
    for (const aub of aubSections) {
      for (const attr of aub.sectionAttributes ?? []) {
        if (!attrMap.has(attr.description) && !newAttrs.find((a) => a.name === attr.description)) {
          newAttrs.push({ name: attr.description });
        }
      }
    }

    // ── batch upsert new entities ──────────────────────────────────
    // Insert brand-new courses (always with credits, defaulting to '0') and
    // refresh existing ones whenever AUB reports credits, so '0'-credit
    // placeholders get corrected as soon as AUB provides the real figure.
    // Courses are refreshed in place, never deleted.
    if (newCourses.length > 0) {
      for (let i = 0; i < newCourses.length; i += 500) {
        const batch = newCourses.slice(i, i + 500);
        const { data, error } = await db
          .from('courses')
          .upsert(batch, { onConflict: 'subject,course_number', ignoreDuplicates: false })
          .select('id, subject, course_number');
        if (error) throw error;
        for (const c of (data ?? []) as CourseRow[]) {
          courseMap.set(`${c.subject}|${c.course_number}`, c);
        }
      }
      logger.info({ count: newCourses.length }, 'AUB sync: inserted courses');
    }

    if (updateCourses.length > 0) {
      for (let i = 0; i < updateCourses.length; i += 500) {
        const batch = updateCourses.slice(i, i + 500);
        const { data, error } = await db
          .from('courses')
          .upsert(batch, { onConflict: 'subject,course_number', ignoreDuplicates: false })
          .select('id, subject, course_number');
        if (error) throw error;
        for (const c of (data ?? []) as CourseRow[]) {
          courseMap.set(`${c.subject}|${c.course_number}`, c);
        }
      }
      logger.info({ count: updateCourses.length }, 'AUB sync: updated courses');
    }

    if (newProfs.length > 0) {
      const { data, error } = await db
        .from('professors')
        .upsert(newProfs, { ignoreDuplicates: true })
        .select('id, first_name, last_name');
      if (error) throw error;
      for (const p of (data ?? []) as ProfRow[]) {
        profMap.set(`${p.first_name}|${p.last_name}`, p);
      }
      logger.info({ count: newProfs.length }, 'AUB sync: created professors');
    }

    if (newAttrs.length > 0) {
      const { data, error } = await db
        .from('attributes')
        .upsert(newAttrs, { onConflict: 'name', ignoreDuplicates: true })
        .select('id, name');
      if (error) throw error;
      for (const a of (data ?? []) as AttrRow[]) {
        attrMap.set(a.name, a);
      }
      logger.info({ count: newAttrs.length }, 'AUB sync: created attributes');
    }

    // ── build section rows + meetings + course_attributes ────────────
    const allSectionData: Array<Record<string, unknown>> = [];
    const caToInsert: Array<{ course_id: number; attribute_id: number }> = [];
    const seenCRNs = new Set<string>();
    const pendingMeetings: Array<Record<string, unknown>> = [];

    for (const aub of aubSections) {
      const course = courseMap.get(`${aub.subject}|${aub.courseNumber}`);
      if (!course) continue;

      let professorId: number | null = null;
      const fac = aub.faculty?.[0];
      if (fac) {
        const { firstName, lastName } = parseName(fac.displayName);
        const prof = profMap.get(`${firstName}|${lastName}`);
        professorId = prof?.id ?? null;
      }

      const firstMeeting = aub.meetingsFaculty?.[0]?.meetingTime ?? null;

      // Build has_* booleans as union of ALL meetings for this section
      const has = { m: false, t: false, w: false, r: false, f: false, s: false, u: false };
      for (const mf of aub.meetingsFaculty ?? []) {
        const mt = mf.meetingTime;
        if (mt.monday) has.m = true;
        if (mt.tuesday) has.t = true;
        if (mt.wednesday) has.w = true;
        if (mt.thursday) has.r = true;
        if (mt.friday) has.f = true;
        if (mt.saturday) has.s = true;
        if (mt.sunday) has.u = true;
      }

      allSectionData.push({
        course_id: course.id,
        term_id: term.id,
        professor_id: professorId,
        section_number: aub.sequenceNumber,
        crn: aub.courseReferenceNumber,
        days: buildDaysString(firstMeeting),
        start_time: parseTime(firstMeeting?.beginTime ?? null),
        end_time: parseTime(firstMeeting?.endTime ?? null),
        schedule_type: aub.scheduleTypeDescription,
        campus: aub.campusDescription,
        seats_total: toNum(aub.maximumEnrollment),
        seats_remaining: toNum(aub.seatsAvailable),
        status: null,
        room:
          firstMeeting?.buildingDescription && firstMeeting?.room
            ? `${firstMeeting.buildingDescription} ${firstMeeting.room}`
            : (firstMeeting?.buildingDescription ?? firstMeeting?.room ?? null),
        link_identifier: aub.linkIdentifier ?? null,
        meeting_schedule_type: firstMeeting?.meetingScheduleType ?? null,
        start_date: parseAubDate(firstMeeting?.startDate ?? null),
        end_date: parseAubDate(firstMeeting?.endDate ?? null),
        has_monday: has.m,
        has_tuesday: has.t,
        has_wednesday: has.w,
        has_thursday: has.r,
        has_friday: has.f,
        has_saturday: has.s,
        has_sunday: has.u,
      });

      seenCRNs.add(aub.courseReferenceNumber);

      // Stage meetings for this section (keyed by CRN, resolved after upsert)
      for (const mf of aub.meetingsFaculty ?? []) {
        const mt = mf.meetingTime;
        if (!mt) continue;
        pendingMeetings.push({
          _crn: aub.courseReferenceNumber,
          term_id: term.id,
          monday: mt.monday ?? false,
          tuesday: mt.tuesday ?? false,
          wednesday: mt.wednesday ?? false,
          thursday: mt.thursday ?? false,
          friday: mt.friday ?? false,
          saturday: mt.saturday ?? false,
          sunday: mt.sunday ?? false,
          start_time: parseTime(mt.beginTime ?? null),
          end_time: parseTime(mt.endTime ?? null),
          building: mt.buildingDescription ?? null,
          room: mt.room ?? null,
          meeting_type: mt.meetingType ?? null,
          hours_week: mt.hoursWeek ?? null,
          start_date: parseAubDate(mt.startDate ?? null),
          end_date: parseAubDate(mt.endDate ?? null),
        });
      }

      for (const aubAttr of aub.sectionAttributes ?? []) {
        const attr = attrMap.get(aubAttr.description);
        if (attr) {
          const caKey = `${course.id}|${attr.id}`;
          if (!caToInsert.find((ca) => `${ca.course_id}|${ca.attribute_id}` === caKey)) {
            caToInsert.push({ course_id: course.id, attribute_id: attr.id });
          }
        }
      }
    }

    // batch upsert all sections (uses unique constraint on term_id + crn)
    let synced = 0;
    for (let i = 0; i < allSectionData.length; i += 500) {
      const batch = allSectionData.slice(i, i + 500);
      const { error } = await db
        .from('sections')
        .upsert(batch, { onConflict: 'term_id,crn', ignoreDuplicates: false });
      if (error) {
        logger.error(
          { error, batchStart: i, batchSize: batch.length },
          'AUB sync: section upsert failed',
        );
      } else {
        synced += batch.length;
      }
    }

    // Resolve CRN -> section_id and upsert section_meetings
    if (pendingMeetings.length > 0) {
      const { data: sectionRows, error: lookupErr } = await db
        .from('sections')
        .select('id, crn')
        .eq('term_id', term.id)
        .limit(10000);
      if (!lookupErr && sectionRows) {
        const crnToId = new Map<string, number>();
        for (const row of sectionRows as Array<{ id: number; crn: string }>) {
          crnToId.set(row.crn, row.id);
        }

        // Delete existing meetings for this term, then re-insert
        const { error: delErr } = await db
          .from('section_meetings')
          .delete()
          .eq('term_id', term.id);
        if (delErr) {
          logger.error({ error: delErr }, 'AUB sync: section_meetings delete failed');
        }

        const meetingRows = pendingMeetings
          .map((m) => {
            const sectionId = crnToId.get(m._crn as string);
            if (!sectionId) return null;
            const rest = { ...m };
            delete rest._crn;
            return { section_id: sectionId, ...rest };
          })
          .filter((r) => r !== null) as Array<Record<string, unknown>>;

        let meetingsInserted = 0;
        for (let i = 0; i < meetingRows.length; i += 500) {
          const batch = meetingRows.slice(i, i + 500);
          const { error } = await db.from('section_meetings').insert(batch);
          if (error) {
            logger.error(
              { error, batchStart: i, batchSize: batch.length },
              'AUB sync: section_meetings insert failed',
            );
          } else {
            meetingsInserted += batch.length;
          }
        }
        logger.info({ count: meetingsInserted }, 'AUB sync: section_meetings inserted');
      }
    }

    // batch upsert course_attributes
    if (caToInsert.length > 0) {
      const { error } = await db
        .from('course_attributes')
        .upsert(caToInsert, { onConflict: 'course_id,attribute_id', ignoreDuplicates: true });
      if (error) {
        logger.error({ error }, 'AUB sync: course_attributes upsert failed');
      }
    }

    // ── mark missing sections as inactive ──────────────────────────
    let deactivated = 0;
    for (const [, sec] of sectionMap) {
      if (!seenCRNs.has(sec.crn) && sec.term_id === term.id) {
        const { error } = await db.from('sections').update({ status: 'inactive' }).eq('id', sec.id);
        if (!error) deactivated++;
      }
    }

    // ── sync term_courses (which courses are offered this term) ────
    // Rebuild this term's offering list from the freshly fetched sections so it
    // stays in sync. Courses themselves are never deleted (their rows may serve
    // other terms); only the term-specific "offered here" join is refreshed.
    const fetchedCourseIds = new Set<number>();
    for (const aub of aubSections) {
      const course = courseMap.get(`${aub.subject}|${aub.courseNumber}`);
      if (course) fetchedCourseIds.add(course.id);
    }
    if (fetchedCourseIds.size > 0) {
      const tcRows = [...fetchedCourseIds].map((course_id) => ({
        term_id: term.id,
        course_id,
      }));
      for (let i = 0; i < tcRows.length; i += 500) {
        const batch = tcRows.slice(i, i + 500);
        const { error } = await db
          .from('term_courses')
          .upsert(batch, { onConflict: 'term_id,course_id', ignoreDuplicates: true });
        if (error) {
          logger.error({ error }, 'AUB sync: term_courses upsert failed');
        }
      }
      // Drop joins for courses no longer offered this term (id-only cleanup).
      const { error: cleanupErr } = await db
        .from('term_courses')
        .delete()
        .eq('term_id', term.id)
        .not('course_id', 'in', `(${[...fetchedCourseIds].join(',')})`);
      if (cleanupErr) {
        logger.error({ error: cleanupErr }, 'AUB sync: term_courses cleanup failed');
      }
    }

    logger.info({ synced, deactivated, termId: term.id }, 'AUB sync: term data synced');
  } catch (err) {
    logger.error({ err, termId: term.id }, 'AUB sync: term data failed');
    throw err;
  }
}

// ── scheduler ────────────────────────────────────────────────────────

export function startAubSyncJob(): void {
  const { syncIntervalMs, syncOnStartup } = config.aub;

  if (syncOnStartup) {
    void syncAubData();
  }

  syncTimer = setInterval(() => {
    void syncAubData();
  }, syncIntervalMs);

  logger.info({ intervalMs: syncIntervalMs, syncOnStartup }, 'AUB sync job scheduled');
}

export function stopAubSyncJob(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
    logger.info('AUB sync job stopped');
  }
}
