import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routeOverride, queryProposal, optimizerExtraction, executeQuery, gemini } = vi.hoisted(() => {
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
  };
});

vi.mock('../src/services/assistant-gemini.js', () => ({
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

vi.mock('../src/services/assistant-database.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/assistant-database.js')>();
  return { ...actual, executeAssistantQuery: executeQuery };
});

import {
  clearSessionHistory,
  getSessionHistory,
  handleMessage,
  MAX_HISTORY_MESSAGES,
} from '../src/services/assistant.service.js';

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