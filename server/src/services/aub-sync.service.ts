import config from '../config.js';
import { requireSupabaseClient } from '../db/supabase.js';
import { logger } from '../utils/logger.js';
import { fetchAllSections } from './aub-registration.service.js';
import type { AubMeetingTime } from './aub-registration.service.js';

let syncTimer: ReturnType<typeof setInterval> | undefined;
let syncing = false;

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

function parseName(displayName: string | undefined): { firstName: string; lastName: string } {
  if (!displayName) return { firstName: 'Unknown', lastName: 'Unknown' };
  const parts = displayName.split(', ');
  if (parts.length >= 2) {
    return { firstName: parts[1]?.trim() ?? 'Unknown', lastName: parts[0]?.trim() ?? 'Unknown' };
  }
  return { firstName: displayName.trim(), lastName: '' };
}

// ── sync ─────────────────────────────────────────────────────────────

type TermRow = { id: number; name: string };
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
    const termCode = config.aub.termCode;
    const aubSections = await fetchAllSections(termCode);
    if (aubSections.length === 0) {
      logger.warn('AUB sync: no sections to sync');
      return;
    }

    const db = requireSupabaseClient();

    // ── load existing data ─────────────────────────────────────────
    const [termsRes, coursesRes, profsRes, sectionsRes, attrsRes] = await Promise.all([
      db.from('terms').select('id, name'),
      db.from('courses').select('id, subject, course_number').limit(10000),
      db.from('professors').select('id, first_name, last_name').limit(10000),
      db.from('sections').select('id, term_id, crn').limit(10000),
      db.from('attributes').select('id, name').limit(10000),
    ]);

    if (termsRes.error) throw termsRes.error;
    if (coursesRes.error) throw coursesRes.error;
    if (profsRes.error) throw profsRes.error;
    if (sectionsRes.error) throw sectionsRes.error;
    if (attrsRes.error) throw attrsRes.error;

    const terms = (termsRes.data ?? []) as TermRow[];
    const existingCourses = (coursesRes.data ?? []) as CourseRow[];
    const existingProfs = (profsRes.data ?? []) as ProfRow[];
    const existingSections = (sectionsRes.data ?? []) as SectionRow[];
    const existingAttrs = (attrsRes.data ?? []) as AttrRow[];

    // ── ensure term ───────────────────────────────────────────────
    let term = terms.find((t) => t.name === termCode);
    if (!term) {
      const { data, error } = await db
        .from('terms')
        .insert({ name: termCode, start_date: null, end_date: null })
        .select('id, name')
        .single();
      if (error) throw error;
      term = data as TermRow;
      logger.info({ termId: term.id, termCode }, 'AUB sync: created term');
    }

    // ── collect unique entities from AUB data ──────────────────────
    const courseMap = new Map<string, CourseRow>();
    for (const c of existingCourses) courseMap.set(`${c.subject}|${c.course_number}`, c);

    const profMap = new Map<string, ProfRow>();
    for (const p of existingProfs) profMap.set(`${p.first_name}|${p.last_name}`, p);

    const attrMap = new Map<string, AttrRow>();
    for (const a of existingAttrs) attrMap.set(a.name, a);

    const sectionMap = new Map<string, SectionRow>();
    for (const s of existingSections) sectionMap.set(`${s.term_id}|${s.crn}`, s);

    // collect unique new courses
    const newCourses: Array<{
      subject: string;
      course_number: string;
      title: string;
      credits: string;
    }> = [];
    for (const aub of aubSections) {
      const key = `${aub.subject}|${aub.courseNumber}`;
      if (!courseMap.has(key)) {
        const dup = newCourses.find(
          (c) => c.subject === aub.subject && c.course_number === aub.courseNumber,
        );
        if (!dup) {
          newCourses.push({
            subject: aub.subject,
            course_number: aub.courseNumber,
            title: aub.courseTitle,
            credits: aub.creditHours ?? '0',
          });
        }
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
    if (newCourses.length > 0) {
      const { data, error } = await db
        .from('courses')
        .upsert(newCourses, { onConflict: 'subject,course_number', ignoreDuplicates: true })
        .select('id, subject, course_number');
      if (error) throw error;
      for (const c of (data ?? []) as CourseRow[]) {
        courseMap.set(`${c.subject}|${c.course_number}`, c);
      }
      logger.info({ count: newCourses.length }, 'AUB sync: created courses');
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

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info({ synced, deactivated, elapsed }, 'AUB sync: completed');
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.error({ err, elapsed }, 'AUB sync: failed');
  } finally {
    syncing = false;
  }
}

// ── scheduler ────────────────────────────────────────────────────────

export function startAubSyncJob(): void {
  const { syncIntervalMs, syncOnStartup, termCode } = config.aub;

  if (syncOnStartup) {
    void syncAubData();
  }

  syncTimer = setInterval(() => {
    void syncAubData();
  }, syncIntervalMs);

  logger.info({ termCode, intervalMs: syncIntervalMs, syncOnStartup }, 'AUB sync job scheduled');
}

export function stopAubSyncJob(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
    logger.info('AUB sync job stopped');
  }
}
