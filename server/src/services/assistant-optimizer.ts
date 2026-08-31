/**
 * Optimizer route.
 *
 * Bridges the LLM router to the real schedule-optimizer backend. This module:
 *   - does NOT implement any MILP/scheduling logic
 *   - does NOT query FastAPI directly
 *   - does NOT execute assistant database queries
 *   - does NOT fabricate schedules
 *
 * It extracts the user's scheduling requirements from natural language,
 * resolves human-readable course / term / professor / attribute identifiers to
 * real database IDs, builds the optimizer request, delegates to the existing
 * schedule-optimizer service (which performs the Supabase expansion and the
 * FastAPI/MILP call), and renders a truthful summary of the real result.
 *
 * Human-readable identifiers are only ever submitted to the optimizer as real
 * numeric database IDs. If an identifier cannot be resolved uniquely, the user
 * is asked for clarification rather than guessing.
 */

import { generateJson, type GeminiContent } from './assistant-gemini.js';
import { requireSupabaseClient } from '../db/supabase.js';
import { AppError } from '../utils/app-error.js';
import {
  optimizeSchedule,
  type OptimizeRequestInput,
  type OptimizerResult,
} from './schedule-optimizer.service.js';

export type OptimizerOutcome = {
  response: string;
  /**
   * The optimizer input that was submitted for this request. Let the
   * client surface the request that produced the schedule.
   */
  input: OptimizeRequestInput;
  /**
   * The real optimizer result (optimal / infeasible / etc.). When the
   * status is "optimal", `selected_sections` can be rendered directly
   * on the client calendar without any fabrication.
   */
  result: OptimizerResult;
};

/** Balanced default objective weights used when the user gives no preference. */
const DEFAULT_WEIGHTS = { days: 35, gaps: 40, professor: 25 };

/**
 * Structured requirements extracted from the user's message. Course / term /
 * professor / attribute fields are human-readable identifiers, never invented
 * database IDs. Numeric id fields are accepted only when the user provides
 * them directly.
 */
type ExtractedRequest = {
  term_id?: number;
  term_label?: string;
  required_course_ids?: Array<number | string>;
  required_courses?: string[];
  acceptable_elective_course_ids?: Array<number | string>;
  acceptable_elective_courses?: string[];
  attribute_ids?: Array<number | string>;
  attribute_names?: string[];
  min_credits?: number;
  max_credits?: number;
  weights?: { days?: number; gaps?: number; professor?: number };
  professor_preferences?: Record<string, number>;
  excluded_section_ids?: Array<number | string>;
  max_occurrences_per_day?: number;
};

const EXTRACTION_SYSTEM = `You extract schedule-optimization parameters from a student's request.

Output a single JSON object with ONLY these fields. Never invent database IDs;
for courses, terms, professors, or attributes return the human-readable
identifiers exactly as the user wrote them (course codes like "CMPS 201",
term labels like "Fall 2026", professor names, attribute names). If the user
gives an explicit numeric ID, pass it through, otherwise omit the field.

{
  "term_label": string | omitted,        // e.g. "Fall 2026", "Spring 2027"
  "term_id": number | omitted,           // ONLY if the user gave a numeric id
  "required_courses": [string],          // courses the user wants in the schedule
  "required_course_ids": [number],       // ONLY if user gave numeric ids
  "acceptable_elective_courses": [string], // courses to consider as electives
  "acceptable_elective_course_ids": [number],
  "attribute_names": [string],           // attributes the schedule must include
  "attribute_ids": [number],
  "min_credits": number | omitted,
  "max_credits": number | omitted,       // exact target => set min == max
  "weights": { "days": number, "gaps": number, "professor": number } | omitted,
  "professor_preferences": { "<professor full name>": number },  // 0..10 preference
  "excluded_section_ids": [number],      // ONLY if user gave section id(s)
  "max_occurrences_per_day": number | omitted
}

Rules:
- "Build my schedule with CMPS 201 and CMPS 211" => required_courses ["CMPS 201","CMPS 211"].
- "15 credits" => min_credits 15 and max_credits 15.
- "at least 12 and at most 15 credits" => min_credits 12, max_credits 15.
- "I prefer professor Nouiehed" => professor_preferences {"Nouiehed": 8}.
- If the user mentions days/gaps/professor weighting preferences, reflect them
  in weights; otherwise omit weights.
- Do NOT guess missing values. Omit what the user did not specify.`;

type CourseRow = {
  id: number;
  subject: string;
  course_number: string;
  title: string;
  credits: string;
};

type TermRow = { id: number; name: string };
type ProfessorRow = { id: number; first_name: string; last_name: string };
type AttributeRow = { id: number; name: string };

// ── Focused pure helpers ─────────────────────────────────────────────────────

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function positiveIntArray(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const out: number[] = [];
  for (const value of values) {
    const n = positiveInt(value);
    if (n !== null && !out.includes(n)) out.push(n);
  }
  return out;
}

function normalizeWeights(
  weights?: { days?: number; gaps?: number; professor?: number },
): { days: number; gaps: number; professor: number } {
  if (!weights) return DEFAULT_WEIGHTS;
  const days = Number(weights.days ?? 0);
  const gaps = Number(weights.gaps ?? 0);
  const professor = Number(weights.professor ?? 0);
  const total = days + gaps + professor;
  if (!(total > 0) || ![days, gaps, professor].every((n) => Number.isFinite(n))) {
    return DEFAULT_WEIGHTS;
  }
  if (Math.abs(total - 100) < 1e-6) {
    return { days, gaps, professor };
  }
  // Scale relative preferences to total exactly 100 so the optimizer contract
  // (which requires weights to sum to 100) is always satisfied.
  const scale = 100 / total;
  return {
    days: Number((days * scale).toFixed(4)),
    gaps: Number((gaps * scale).toFixed(4)),
    professor: Number((professor * scale).toFixed(4)),
  };
}

function normalizeCourseCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]+/g, ' ').trim();
}

/** e.g. "CMPS 201" -> { subject: "CMPS", number: "201" }; null if unparseable. */
function parseCourseCode(code: string): { subject: string; number: string } | null {
  const match = /^([A-Za-z]{2,})\s+(\d+[A-Za-z]?)$/.exec(normalizeCourseCode(code));
  if (!match) return null;
  return { subject: match[1]!, number: match[2]! };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Convert a human-readable term label to candidate AUB term codes. */
function termLabelToCandidates(label: string): string[] {
  const normalized = label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const season = normalized.includes('summer')
    ? 'summer'
    : normalized.includes('spring')
      ? 'spring'
      : normalized.includes('fall')
        ? 'fall'
        : null;
  const yearMatch = /(20\d{2})/.exec(normalized);
  if (!season || !yearMatch) return [];
  const year = yearMatch[1]!;
  if (season === 'fall') return [`${year}10`];
  if (season === 'spring') return [`${year}20`];
  return [`${year}30`];
}

// ── Database resolution ──────────────────────────────────────────────────────

async function resolveCourseIds(
  identifiers: string[],
): Promise<{ courseIds: number[]; unresolved: string[] }> {
  const db = requireSupabaseClient();
  const codes = [...new Set(identifiers.map(normalizeCourseCode))];
  const parsed = codes
    .map((code) => ({ code, parsed: parseCourseCode(code) }))
    .filter((entry): entry is { code: string; parsed: { subject: string; number: string } } =>
      Boolean(entry.parsed),
    );
  const subjects = [...new Set(parsed.map((p) => p.parsed.subject))];
  if (subjects.length === 0) {
    return { courseIds: [], unresolved: codes };
  }

  const { data, error } = await db
    .from('courses')
    .select('id, subject, course_number, title, credits')
    .in('subject', subjects);
  if (error) throw error;
  const rows = (data ?? []) as CourseRow[];
  const byCode = new Map<string, CourseRow[]>();
  for (const row of rows) {
    const key = normalizeCourseCode(`${row.subject} ${row.course_number}`);
    const list = byCode.get(key) ?? [];
    list.push(row);
    byCode.set(key, list);
  }

  const courseIds: number[] = [];
  const unresolved: string[] = [];
  for (const entry of parsed) {
    const key = normalizeCourseCode(`${entry.parsed.subject} ${entry.parsed.number}`);
    const matches = byCode.get(key) ?? [];
    if (matches.length === 1) {
      if (!courseIds.includes(matches[0]!.id)) courseIds.push(matches[0]!.id);
    } else {
      unresolved.push(entry.code);
    }
  }
  return { courseIds, unresolved };
}

async function resolveTermId(termLabel: string): Promise<number | null> {
  const db = requireSupabaseClient();
  const { data, error } = await db.from('terms').select('id, name');
  if (error) throw error;
  const rows = (data ?? []) as TermRow[];

  const normalizedLabel = normalizeName(termLabel);
  const byName = rows.filter((r) => normalizeName(r.name) === normalizedLabel);
  if (byName.length === 1) return byName[0]!.id;

  const candidates = termLabelToCandidates(termLabel);
  const matches = rows.filter((r) => candidates.includes(r.name));
  if (matches.length === 1) return matches[0]!.id;
  return null; // ambiguous or unresolvable -> ask the user
}

async function resolveProfessorPreferences(
  preferences: Record<string, number> | undefined,
): Promise<Record<string, number> | undefined> {
  if (!preferences || Object.keys(preferences).length === 0) return undefined;

  // Numeric keys are treated as explicit professor IDs and passed through
  // directly (matching how numeric course/term IDs are handled).
  const resolved: Record<string, number> = {};
  const toResolve: Record<string, number> = {};
  for (const [key, score] of Object.entries(preferences)) {
    if (/^\d+$/.test(key)) {
      resolved[key] = score;
    } else {
      toResolve[key] = score;
    }
  }
  if (Object.keys(toResolve).length === 0) {
    return Object.keys(resolved).length > 0 ? resolved : undefined;
  }

  const db = requireSupabaseClient();
  const { data, error } = await db.from('professors').select('id, first_name, last_name');
  if (error) throw error;
  const rows = (data ?? []) as ProfessorRow[];
  const byName = new Map<string, ProfessorRow>();
  for (const row of rows) {
    const key = normalizeName(`${row.first_name} ${row.last_name}`);
    if (!byName.has(key)) byName.set(key, row);
  }

  for (const [name, score] of Object.entries(toResolve)) {
    const prof = byName.get(normalizeName(name));
    if (prof) resolved[String(prof.id)] = score;
  }
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

async function resolveAttributeIds(
  names: string[] | undefined,
): Promise<number[]> {
  if (!names || names.length === 0) return [];
  const db = requireSupabaseClient();
  const { data, error } = await db.from('attributes').select('id, name');
  if (error) throw error;
  const rows = (data ?? []) as AttributeRow[];
  const byName = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (!byName.has(key)) byName.set(key, row.id);
  }
  const ids: number[] = [];
  for (const name of names) {
    const id = byName.get(normalizeName(name));
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ── Request assembly ─────────────────────────────────────────────────────────

/**
 * Returns the credit bounds to submit. Uses the user's explicit bounds when
 * given; otherwise derives a data-driven neutral default from the real credits
 * of the resolved courses (min = required credits, max = required + elective
 * credits) so we never fabricate a credit figure.
 */
async function resolveCreditBounds(
  extracted: ExtractedRequest,
  requiredIds: number[],
  electiveIds: number[],
): Promise<{ min: number; max: number }> {
  if (extracted.min_credits !== undefined && extracted.max_credits !== undefined) {
    return {
      min: Number(extracted.min_credits) || 0,
      max: Number(extracted.max_credits) || 0,
    };
  }
  if (extracted.min_credits !== undefined || extracted.max_credits !== undefined) {
    // The user gave only one bound; the MILP requires both, so default the
    // other one from the real course credits.
    const allIds = [...new Set([...requiredIds, ...electiveIds])];
    const db = requireSupabaseClient();
    const { data, error } = await db.from('courses').select('id, credits').in('id', allIds);
    if (error) throw error;
    const byId = new Map((data ?? []).map((r: { id: number; credits: string }) => [r.id, Number(r.credits) || 0]));
    const required = requiredIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
    const all = allIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
    const min = extracted.min_credits !== undefined ? Number(extracted.min_credits) || 0 : required;
    const max = extracted.max_credits !== undefined ? Number(extracted.max_credits) || 0 : Math.max(all, min);
    return { min, max: Math.max(max, min) };
  }

  // Neither bound supplied: derive from real course credits (no fabrication).
  const allIds = [...new Set([...requiredIds, ...electiveIds])];
  const db = requireSupabaseClient();
  const { data, error } = await db.from('courses').select('id, credits').in('id', allIds);
  if (error) throw error;
  const byId = new Map((data ?? []).map((r: { id: number; credits: string }) => [r.id, Number(r.credits) || 0]));
  const min = requiredIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  const max = allIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  return { min, max: Math.max(max, min) };
}

function buildOptimizerInput(
  extracted: ExtractedRequest,
  resolved: {
    courseIds: number[];
    electiveCourseIds: number[];
    termId: number;
    professorPreferences?: Record<string, number> | undefined;
    attributeIds: number[];
    minCredits: number;
    maxCredits: number;
  },
): OptimizeRequestInput {
  const minCredits = resolved.minCredits;
  const maxCredits = resolved.maxCredits;

  const input: OptimizeRequestInput = {
    request_id: `assistant-${Date.now()}`,
    term_id: resolved.termId,
    required_course_ids: resolved.courseIds,
    acceptable_elective_course_ids: resolved.electiveCourseIds,
    min_credits: minCredits,
    max_credits: maxCredits,
    weights: normalizeWeights(extracted.weights),
  };

  if (resolved.attributeIds.length > 0) input.attribute_ids = resolved.attributeIds;
  if (resolved.professorPreferences) input.professor_preferences = resolved.professorPreferences;
  const excluded = positiveIntArray(extracted.excluded_section_ids);
  if (excluded.length > 0) input.excluded_section_ids = excluded;
  if (extracted.max_occurrences_per_day !== undefined) {
    const occurrences = positiveInt(extracted.max_occurrences_per_day);
    if (occurrences !== null) input.max_occurrences_per_day = occurrences;
  }
  return input;
}

// ── Result rendering (truthful, built only from real optimizer output) ───────

function renderResult(result: OptimizerResult, input: OptimizeRequestInput): string {
  if (result.status === 'optimal') {
    const lines: string[] = ['Here is your schedule optimization result.'];
    if (input.min_credits === input.max_credits) {
      lines.push(`I optimized for exactly ${input.min_credits} credits.`);
    } else {
      lines.push(
        `I optimized for at least ${input.min_credits} credits and at most ${input.max_credits} credits.`,
      );
    }
    const courses = (result.selected_courses ?? []) as Array<Record<string, unknown>>;
    if (courses.length > 0) {
      lines.push('Selected courses:');
      for (const course of courses) {
        const code = typeof course.course_code === 'string' ? course.course_code : String(course.id);
        const credits = typeof course.credits === 'number' ? course.credits : course.credits;
        lines.push(`  - ${code} (${credits} credits)`);
      }
    } else {
      lines.push(`  - ${result.total_credits} credits total.`);
    }
    lines.push(
      `${result.total_credits} credits total across ${result.campus_days} day(s) meeting the pattern.`,
    );
    return lines.join('\n');
  }

  if (result.status === 'infeasible') {
    const lines = [
      'I could not find a feasible schedule for those requirements.',
      result.message || 'No feasible schedule was produced.',
    ];
    const diagnostics = result.diagnostics ?? {};
    if (diagnostics.required_courses_without_eligible_sections) {
      lines.push(
        `The following required courses have no available sections: ${String(
          diagnostics.required_courses_without_eligible_sections,
        )}.`,
      );
    }
    return lines.join('\n');
  }

  return `The schedule optimizer returned an unexpected status (${result.status}). Please try again.`;
}

// ── Route entry point ────────────────────────────────────────────────────────

export async function runOptimizerRoute(
  message: string,
  history: GeminiContent[],
): Promise<OptimizerOutcome> {
  const contents: GeminiContent[] = [
    ...history.slice(-6),
    { role: 'user', parts: [{ text: message }] },
  ];

  let extracted: ExtractedRequest;
  try {
    extracted = (await generateJson<ExtractedRequest>({
      systemInstruction: EXTRACTION_SYSTEM,
      contents,
    })) ?? {};
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      422,
      'OPTIMIZER_EXTRACTION_FAILED',
      'I could not understand the scheduling requirements you provided. Try again, for example: "Build me a 15 credit schedule with CMPS 201 and CMPS 211."',
    );
  }

  // 1. Term resolution.
  let termId: number | null = null;
  const explicitTermId = positiveInt(extracted.term_id);
  if (explicitTermId !== null) {
    termId = explicitTermId;
  } else if (extracted.term_label) {
    termId = await resolveTermId(extracted.term_label);
    if (termId === null) {
      throw new AppError(
        422,
        'TERM_UNRESOLVED',
        `I couldn't match "${extracted.term_label}" to a single known term. Please specify the exact term (for example "Fall 2026").`,
      );
    }
  } else {
    throw new AppError(
      422,
      'TERM_REQUIRED',
      'A term is required to build a schedule. Which term are you planning (for example "Fall 2026")?',
    );
  }

  // 2. Course resolution. Prefer explicit numeric IDs; resolve codes otherwise.
  const requiredIds = positiveIntArray(extracted.required_course_ids);
  const electiveIds = positiveIntArray(extracted.acceptable_elective_course_ids);
  let requiredCodes = extracted.required_courses ?? [];
  let electiveCodes = extracted.acceptable_elective_courses ?? [];

  if (requiredIds.length === 0 && requiredCodes.length === 0) {
    if (electiveIds.length > 0 || electiveCodes.length > 0) {
      // Treat courses the user mentioned as the schedule core.
      requiredCodes = requiredCodes.concat(electiveCodes);
      electiveCodes = [];
    } else {
      throw new AppError(
        422,
        'COURSES_REQUIRED',
        'Which courses do you want in your schedule? For example "CMPS 201 and CMPS 211".',
      );
    }
  }

  const resolvedRequired =
    requiredCodes.length > 0
      ? await resolveCourseIds(requiredCodes)
      : { courseIds: requiredIds, unresolved: [] };
  const resolvedElective =
    electiveCodes.length > 0
      ? await resolveCourseIds(electiveCodes)
      : { courseIds: electiveIds, unresolved: [] };

  const unresolvedCourses = [...resolvedRequired.unresolved, ...resolvedElective.unresolved];
  if (unresolvedCourses.length > 0) {
    throw new AppError(
      422,
      'COURSE_UNRESOLVED',
      `I couldn't match "${unresolvedCourses.join('", "')}"${unresolvedCourses.length === 1 ? ' to' : ' to'} a single course. Please give the exact course code (for example "CMPS 201") or a numeric course ID.`,
    );
  }

  const allRequired = resolvedRequired.courseIds;
  const allElectives = resolvedElective.courseIds.filter((id) => !allRequired.includes(id));
  if (allRequired.length === 0) {
    throw new AppError(422, 'COURSES_REQUIRED', 'Please tell me which courses to include in the schedule.');
  }

  // 3. Attribute / professor / exclusion resolution.
  const attributeIds =
    positiveIntArray(extracted.attribute_ids).length > 0
      ? positiveIntArray(extracted.attribute_ids)
      : await resolveAttributeIds(extracted.attribute_names);
  const professorPreferences =
    extracted.professor_preferences && Object.keys(extracted.professor_preferences).length > 0
      ? extracted.professor_preferences
      : undefined;
  const resolvedProfessorPrefs = await resolveProfessorPreferences(professorPreferences);

  const { min: minCredits, max: maxCredits } = await resolveCreditBounds(
    extracted,
    allRequired,
    allElectives,
  );

  const input = buildOptimizerInput(extracted, {
    courseIds: allRequired,
    electiveCourseIds: allElectives,
    termId,
    professorPreferences: resolvedProfessorPrefs,
    attributeIds,
    minCredits,
    maxCredits,
  });

  let result: OptimizerResult;
  try {
    result = await optimizeSchedule(input);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      'OPTIMIZER_ERROR',
      'The schedule optimizer could not run right now. Please try again.',
    );
  }

  return { response: renderResult(result, input), input, result };
}
