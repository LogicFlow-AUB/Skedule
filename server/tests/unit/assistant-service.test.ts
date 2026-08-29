import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routeOverride, queryProposal, optimizerExtraction, executeQuery, gemini, optimizeSchedule, fakeClient } =
  vi.hoisted(() => {
    return {
      routeOverride: { value: 'assistant' },
      queryProposal: {
        value: { intent: 'find sections', query: { entity: 'sections', limit: 5 } },
      },
      optimizerExtraction: {
        value: {
          term_id: 1,
          min_credits: 12,
          max_credits: 15,
          required_course_ids: [10, 20],
          summary: 'Fall 2026, 12-15 credits',
        },
      },
      executeQuery: vi.fn(async () => ({ rows: [{ id: 100, section_number: 'L1' }], stats: undefined })),
      gemini: {
        generateJson: vi.fn(),
        generateText: vi.fn(async () => 'Generated answer text.'),
      },
      optimizeSchedule: vi.fn(),
      fakeClient: { value: null as unknown },
    };
  });

vi.mock('../../src/db/supabase.js', () => ({
  requireSupabaseClient: () => fakeClient.value,
}));

vi.mock('../../src/services/assistant-gemini.js', () => ({
  generateJson: (options: { systemInstruction: string }) => {
    if (options.systemInstruction.includes('routing component')) {
      return Promise.resolve({ route: routeOverride.value });
    }
    if (options.systemInstruction.includes('query planner')) {
      return Promise.resolve(queryProposal.value);
    }
    if (options.systemInstruction.includes('schedule-optimization parameters')) {
      return Promise.resolve(optimizerExtraction.value);
    }
    return Promise.resolve({});
  },
  generateText: gemini.generateText,
}));

vi.mock('../../src/services/assistant-database.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/assistant-database.js')>();
  return { ...actual, executeAssistantQuery: executeQuery };
});

vi.mock('../../src/services/schedule-optimizer.service.js', () => ({
  optimizeSchedule: optimizeSchedule,
}));

import {
  clearSessionHistory,
  getSessionHistory,
  handleMessage,
  MAX_HISTORY_MESSAGES,
} from '../../src/services/assistant.service.js';
import { createFakeSupabase } from '../fixtures/fake-supabase.js';

const USER = '5bdce3e1-b0e4-49e6-b4ca-7432bf8937c4';
const OTHER_USER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SESSION = 'svc-test-session';

beforeEach(() => {
  routeOverride.value = 'assistant';
  queryProposal.value = { intent: 'find sections', query: { entity: 'sections', limit: 5 } };
  optimizerExtraction.value = {
    term_id: 1,
    min_credits: 12,
    max_credits: 15,
    required_course_ids: [10, 20],
    summary: 'Fall 2026, 12-15 credits',
  };
  executeQuery.mockClear();
  gemini.generateJson.mockClear();
  gemini.generateText.mockClear();
  optimizeSchedule.mockClear();
  optimizeSchedule.mockResolvedValue({
    status: 'optimal',
    request_id: 'assistant-x',
    selected_course_ids: ['10', '20'],
    selected_section_ids: ['bundle::100', 'bundle::200'],
    selected_section_component_ids: { 'bundle::100': ['100'], 'bundle::200': ['200'] },
    selected_courses: [
      { id: 10, credits: 3, course_code: 'CMPS 201', course_title: 'Data Structures' },
      { id: 20, credits: 3, course_code: 'CMPS 211', course_title: 'Discrete Math' },
    ],
    selected_sections: [],
    total_credits: 6,
    campus_days: 3,
    weekly_largest_gaps_sum_minutes: 0,
    weekly_first_to_last_spans_sum_minutes: 0,
    professor_preference_penalty: 0,
    days: {},
    message: null,
    diagnostics: {},
  });
  clearSessionHistory(SESSION);
});

describe('assistant orchestration — two-route pipeline', () => {
  it('routes a course-info question to the assistant route and answers from data', async () => {
    executeQuery.mockResolvedValueOnce({ rows: [{ id: 100, section_number: 'L1' }], stats: undefined });

    const result = await handleMessage('What sections are available for CMPS 202?', USER, SESSION);

    expect(result.route).toBe('assistant');
    expect(result.response).toContain('Generated answer text');
    expect(executeQuery).toHaveBeenCalledWith(expect.objectContaining({ entity: 'sections' }), USER);
  });

  it('routes a professor question to the assistant route', async () => {
    queryProposal.value = {
      intent: 'professor info',
      query: { entity: 'professors', filters: [{ field: 'last_name', operator: 'eq', value: 'Shayya' }], limit: 5 },
    };
    executeQuery.mockResolvedValueOnce({ rows: [], stats: undefined });

    const result = await handleMessage('Who is professor Shayya?', USER, SESSION);

    expect(result.route).toBe('assistant');
    expect(executeQuery).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'professors' }),
      USER,
    );
  });

  it('routes a schedule-optimization request to the optimizer route and does NOT run assistant DB queries', async () => {
    routeOverride.value = 'optimizer';

    const result = await handleMessage('Create my Fall schedule with 15 credits.', USER, SESSION);

    expect(result.route).toBe('optimizer');
    expect(result.response).toContain('schedule optimization');
    expect(result.response).toContain('15');
    // The optimizer route must never execute assistant database queries.
    expect(executeQuery).not.toHaveBeenCalled();
    // It must call the existing schedule optimizer service (not MILP here).
    expect(optimizeSchedule).toHaveBeenCalledTimes(1);
    const called = optimizeSchedule.mock.calls[0]![0] as Record<string, unknown>;
    expect(called.required_course_ids).toEqual([10, 20]);
    expect(called.term_id).toBe(1);
    expect(called.min_credits).toBe(12);
    expect(called.max_credits).toBe(15);
  });

  it('builds an optimizer request contract with bounded fields', async () => {
    routeOverride.value = 'optimizer';
    optimizerExtraction.value = {
      term_id: '1',
      required_course_ids: [10, 20, 'not-a-number'],
      acceptable_elective_course_ids: [],
      attribute_ids: [],
      min_credits: 12,
      max_credits: 15,
      weights: { days: 9, gaps: 0.2, professor: 1 },
      professor_preferences: { '10': 1 },
    };

    const result = await handleMessage('Build a 12-15 credit schedule preferring Shayya.', USER, SESSION);

    expect(result.route).toBe('optimizer');
    expect(result.response).toContain('at least 12 credits');
    expect(result.response).toContain('at most 15 credits');
    expect(optimizeSchedule).toHaveBeenCalledTimes(1);
    const called = optimizeSchedule.mock.calls[0]![0] as Record<string, unknown>;
    // Non-numeric course id is dropped, string term id is coerced to a number.
    expect(called.required_course_ids).toEqual([10, 20]);
    expect(called.term_id).toBe(1);
    // Relative weights are normalized to total 100 for the optimizer contract.
    const weights = called.weights as { days: number; gaps: number; professor: number };
    expect(Math.abs(weights.days + weights.gaps + weights.professor - 100)).toBeLessThan(1e-6);
    // Numeric professor preference id passes through (no DB lookup required).
    expect(called.professor_preferences).toEqual({ '10': 1 });
  });
});

describe('assistant orchestration — graceful failures', () => {
  it('gives an honest no-data answer instead of inventing content when results are empty', async () => {
    queryProposal.value = {
      intent: 'course lookup',
      query: { entity: 'courses', filters: [{ field: 'course_number', operator: 'eq', value: '999' }], limit: 5 },
    };
    executeQuery.mockResolvedValueOnce({ rows: [], stats: undefined });

    const result = await handleMessage('Is there a course CMPS 999?', USER, SESSION);

    expect(result.route).toBe('assistant');
    // Empty results must still reach the final-answer stage (not crash, not fabricate).
    const call = gemini.generateText.mock.calls.at(-1)?.[0] as { systemInstruction: string };
    expect(call.systemInstruction).toContain('If the results are EMPTY');
    expect(call.systemInstruction).toContain('Do not invent courses, professors, sections, schedules, reviews, or events');
    expect(result.response).toBe('Generated answer text.');
  });

  it('rejects queries scoped to another user with a safe message', async () => {
    queryProposal.value = {
      intent: 'schedules',
      query: {
        entity: 'schedules',
        filters: [{ field: 'user_id', operator: 'eq', value: OTHER_USER }],
        limit: 5,
      },
    };

    const result = await handleMessage('Show my friend’s schedules', USER, SESSION);

    expect(result.route).toBe('assistant');
    expect(result.response).toBe("I can't access another user's private information.");
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('reports a plan-it-cannot-answer gracefully when the generator returns no query', async () => {
    queryProposal.value = { intent: 'no_query', query: null };

    const result = await handleMessage('Why is the sky blue?', USER, SESSION);

    expect(result.route).toBe('assistant');
    expect(result.response).toContain("I couldn't determine what data to look up");
    expect(executeQuery).not.toHaveBeenCalled();
  });
});

describe('assistant orchestration — session history', () => {
  it('persists the exchange in session history', async () => {
    await handleMessage('List CMPS courses.', USER, SESSION);
    await handleMessage('Who teaches CMPS 202?', USER, SESSION);

    const history = getSessionHistory(SESSION);
    expect(history).toHaveLength(4);
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(history[1]?.content).toBe('Generated answer text.');
    expect(history[3]?.content).toBe('Generated answer text.');
  });

  it('prunes long sessions to the history cap', async () => {
    for (let i = 0; i < MAX_HISTORY_MESSAGES + 4; i += 1) {
      await handleMessage(`question ${i}`, USER, SESSION);
    }
    expect(getSessionHistory(SESSION)).toHaveLength(MAX_HISTORY_MESSAGES);
  });
});

describe('assistant optimizer route — identifier resolution & result handling', () => {
  beforeEach(() => {
    routeOverride.value = 'optimizer';
    // Courses: CMPS 201 -> id 10, CMPS 211 -> id 20; two matching CMPS 305 rows
    // to test ambiguity. Terms: "Fall 2026" -> 202610 -> id 7. Professors:
    // Maher Nouiehed -> 45. Attribute "Sustainability" -> 12.
    fakeClient.value = createFakeSupabase({
      courses: [
        { id: 10, subject: 'CMPS', course_number: '201', title: 'Data Structures', credits: '3' },
        { id: 20, subject: 'CMPS', course_number: '211', title: 'Discrete Math', credits: '3' },
        { id: 30, subject: 'CMPS', course_number: '305', title: 'A', credits: '3' },
        { id: 31, subject: 'CMPS', course_number: '305', title: 'B', credits: '3' },
        { id: 40, subject: 'PHIL', course_number: '208', title: 'Ethics', credits: '3' },
      ],
      terms: [{ id: 7, name: '202610' }, { id: 8, name: '202620' }],
      professors: [{ id: 45, first_name: 'Maher', last_name: 'Nouiehed' }],
      attributes: [{ id: 12, name: 'Sustainability' }],
    });
    optimizeSchedule.mockClear();
    optimizeSchedule.mockResolvedValue({
      status: 'optimal',
      selected_course_ids: ['10', '40'],
      selected_section_ids: ['bundle::100'],
      selected_section_component_ids: { 'bundle::100': ['100'] },
      selected_courses: [
        { id: 10, credits: 3, course_code: 'CMPS 201', course_title: 'Data Structures' },
        { id: 40, credits: 3, course_code: 'PHIL 208', course_title: 'Ethics' },
      ],
      selected_sections: [],
      total_credits: 6,
      campus_days: 2,
      weekly_largest_gaps_sum_minutes: 0,
      weekly_first_to_last_spans_sum_minutes: 0,
      professor_preference_penalty: 0,
      days: {},
      message: null,
      diagnostics: {},
    });
    clearSessionHistory(SESSION);
  });

  it('resolves human-readable course codes and term label to real numeric IDs', async () => {
    optimizerExtraction.value = {
      term_label: 'Fall 2026',
      required_courses: ['CMPS 201', 'PHIL 208'],
      min_credits: 6,
      max_credits: 6,
    };

    const result = await handleMessage('Build a 6 credit schedule with CMPS 201 and PHIL 208.', USER, SESSION);

    expect(result.route).toBe('optimizer');
    expect(optimizeSchedule).toHaveBeenCalledTimes(1);
    const called = optimizeSchedule.mock.calls[0]![0] as Record<string, unknown>;
    expect(called.term_id).toBe(7);
    expect(called.required_course_ids).toEqual([10, 40]);
    expect(called.required_course_ids).not.toContain('CMPS 201');
    expect(called.min_credits).toBe(6);
    expect(called.max_credits).toBe(6);
    expect(result.response).toContain('CMPS 201');
    expect(result.response).toContain('PHIL 208');
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('does NOT guess an ambiguous course code; it asks for clarification', async () => {
    optimizerExtraction.value = {
      term_id: 7,
      required_courses: ['CMPS 305'],
      min_credits: 3,
      max_credits: 3,
    };

    const result = await handleMessage('Build a 3 credit schedule with CMPS 305.', USER, SESSION);

    expect(result.route).toBe('optimizer');
    expect(optimizeSchedule).not.toHaveBeenCalled();
    expect(result.response).toContain("couldn't match");
    expect(result.response).toContain('CMPS 305');
  });

  it('does NOT submit a numeric value for an unknown course code', async () => {
    optimizerExtraction.value = {
      term_id: 7,
      required_courses: ['ZZZZ 999'],
      min_credits: 3,
      max_credits: 3,
    };

    const result = await handleMessage('Build a schedule with ZZZZ 999.', USER, SESSION);

    expect(optimizeSchedule).not.toHaveBeenCalled();
    expect(result.response).toContain('ZZZZ 999');
  });

  it('has no required courses after resolution, it asks which courses', async () => {
    optimizerExtraction.value = {
      term_id: 7,
      required_courses: [],
      min_credits: 6,
      max_credits: 6,
    };

    const result = await handleMessage('Build my schedule.', USER, SESSION);

    expect(optimizeSchedule).not.toHaveBeenCalled();
    expect(result.response).toContain('Which courses');
  });

  it('renders an infeasible optimizer result as infeasible, not an error', async () => {
    optimizerExtraction.value = {
      term_id: 7,
      required_courses: ['CMPS 201'],
      min_credits: 6,
      max_credits: 6,
    };
    optimizeSchedule.mockResolvedValue({
      status: 'infeasible',
      selected_course_ids: [],
      selected_section_ids: [],
      selected_section_component_ids: {},
      selected_courses: [],
      selected_sections: [],
      message: 'No feasible schedule was produced.',
      campus_days: 0,
      total_credits: 0,
      weekly_largest_gaps_sum_minutes: 0,
      weekly_first_to_last_spans_sum_minutes: 0,
      professor_preference_penalty: 0,
      days: {},
      diagnostics: { credit_load_conflict: 1 },
    });

    const result = await handleMessage('Build a 6 credit schedule with CMPS 201.', USER, SESSION);

    expect(result.route).toBe('optimizer');
    expect(optimizeSchedule).toHaveBeenCalledTimes(1);
    expect(result.response).toContain('could not find a feasible schedule');
    expect(result.response).toContain('No feasible schedule was produced');
  });
});