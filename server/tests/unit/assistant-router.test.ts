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
  it('routes to "assistant" when the LLM picks it', async () => {
    routerOutput.value = { route: 'assistant' };
    await expect(routeMessage('What sections are available for CMPS 202?')).resolves.toBe('assistant');
  });

  it('routes to "optimizer" when the LLM picks it', async () => {
    routerOutput.value = { route: 'optimizer' };
    await expect(routeMessage('Create my Fall schedule with 15 credits.')).resolves.toBe('optimizer');
  });

  it('only ever accepts the two supported routes', () => {
    expect(VALID_ROUTES).toEqual(['assistant', 'optimizer']);
    expect(isRoute('assistant')).toBe(true);
    expect(isRoute('optimizer')).toBe(true);
    expect(isRoute('bogus')).toBe(false);
    expect(isRoute('schedule-optimizer')).toBe(false);
    expect(isRoute(undefined)).toBe(false);
  });

  it('falls back to a deterministic route when the LLM returns an invalid route', async () => {
    routerOutput.value = { route: 'danger_course' };
    await expect(routeMessage('hello there')).resolves.toBe('assistant');
    await expect(routeMessage('build my best timetable')).resolves.toBe('optimizer');
  });

  it('falls back to "assistant" when the router LLM is unavailable and message is neutral', async () => {
    failRouter.value = true;
    await expect(routeMessage('Who teaches CMPS 202?')).resolves.toBe('assistant');
    await expect(routeMessage('What are the office hours?')).resolves.toBe('assistant');
  });

  it('falls back to "optimizer" when the router LLM is unavailable but the message clearly wants optimization', async () => {
    failRouter.value = true;
    await expect(routeMessage('Find me the best schedule with no Friday classes.')).resolves.toBe('optimizer');
    await expect(routeMessage('Optimize my courses to get 15 credits with no gaps.')).resolves.toBe('optimizer');
  });
});

describe('deterministic fallback classifier', () => {
  it('sends database-information questions to "assistant"', () => {
    expect(fallbackRoute('What sections are available for CMPS 202?')).toBe('assistant');
    expect(fallbackRoute('Show me the average professor rating for Bassam Shayya.')).toBe('assistant');
    expect(fallbackRoute('What events are coming up?')).toBe('assistant');
    expect(fallbackRoute('List PHIL courses.')).toBe('assistant');
  });

  it('sends schedule-generation/optimization requests to "optimizer"', () => {
    expect(fallbackRoute('Create my Fall schedule with 15 credits.')).toBe('optimizer');
    expect(fallbackRoute('Find me the best schedule with no Friday classes.')).toBe('optimizer');
    expect(fallbackRoute('Generate a timetable with no morning classes.')).toBe('optimizer');
    expect(fallbackRoute('I want at least 12 credits and max 15.')).toBe('optimizer');
  });
});