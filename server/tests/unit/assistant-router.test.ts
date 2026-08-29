import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routerOutput, failRouter } = vi.hoisted(() => {
  return {
    routerOutput: { value: { route: 'assistant' } },
    failRouter: { value: false },
  };
});

vi.mock('../../src/services/assistant-gemini.js', () => ({
  generateJson: async () => {
    if (failRouter.value) throw new Error('router unavailable');
    return routerOutput.value;
  },
  generateText: async () => 'text',
}));

import { fallbackRoute, isRoute, routeMessage, VALID_ROUTES } from '../../src/services/assistant-router.js';

beforeEach(() => {
  routerOutput.value = { route: 'assistant' };
  failRouter.value = false;
});

describe('assistant router', () => {
  it('always routes chat to "assistant" so it never auto-triggers the optimizer', async () => {
    routerOutput.value = { route: 'assistant' };
    await expect(routeMessage('What sections are available for CMPS 202?')).resolves.toBe('assistant');
  });

  it('keeps the optimizer out of ordinary chat even for optimization-sounding requests', async () => {
    // Generate is only triggered from the AI Scheduler button, never from chat.
    routerOutput.value = { route: 'optimizer' };
    await expect(routeMessage('Create my Fall schedule with 15 credits.')).resolves.toBe('assistant');
  });

  it('only ever accepts the two supported routes', () => {
    expect(VALID_ROUTES).toEqual(['assistant', 'optimizer']);
    expect(isRoute('assistant')).toBe(true);
    expect(isRoute('optimizer')).toBe(true);
    expect(isRoute('bogus')).toBe(false);
    expect(isRoute('schedule-optimizer')).toBe(false);
    expect(isRoute(undefined)).toBe(false);
  });

  it('never routes to optimizer when the routing LLM is unavailable', async () => {
    failRouter.value = true;
    await expect(routeMessage('Who teaches CMPS 202?')).resolves.toBe('assistant');
    await expect(routeMessage('Find me the best schedule with no Friday classes.')).resolves.toBe('assistant');
  });
});

describe('deterministic fallback classifier', () => {
  it('always answers as "assistant"', () => {
    expect(fallbackRoute('What sections are available for CMPS 202?')).toBe('assistant');
    expect(fallbackRoute('Show me the average professor rating for Bassam Shayya.')).toBe('assistant');
    expect(fallbackRoute('What events are coming up?')).toBe('assistant');
    expect(fallbackRoute('List PHIL courses.')).toBe('assistant');
  });

  it('does not send schedule-generation/optimization requests to the optimizer', () => {
    expect(fallbackRoute('Create my Fall schedule with 15 credits.')).toBe('assistant');
    expect(fallbackRoute('Find me the best schedule with no Friday classes.')).toBe('assistant');
    expect(fallbackRoute('Generate a timetable with no morning classes.')).toBe('assistant');
    expect(fallbackRoute('I want at least 12 credits and max 15.')).toBe('assistant');
  });
});
