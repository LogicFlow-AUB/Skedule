import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

// The client is created once at import time; make sure it is not null so the
// retry/retry-fail paths are actually exercised.
process.env.GEMINI_API_KEY = 'test-key';

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { generateJson } from '../../src/services/assistant-gemini.js';

function capture<T>(promise: Promise<T>): Promise<unknown> {
  // Attach the handler immediately so the rejection is never flagged as
  // unhandled while fake timers are driving the retry loop.
  return promise.then(
    (value) => value,
    (error) => error,
  );
}

beforeEach(() => {
  generateContent.mockReset();
  process.env.GEMINI_MAX_RETRIES = '3';
  vi.useRealTimers();
});

describe('Gemini quota fast-fail', () => {
  it('fails immediately with GEMINI_QUOTA_EXHAUSTED when the daily quota is exhausted', async () => {
    generateContent.mockRejectedValue({
      status: 429,
      message:
        'You exceeded your current quota ... Quota exceeded for metric: ' +
        'generate_content_free_tier_requests ... RESOURCE_EXHAUSTED',
    });

    const outcome = await capture(generateJson({ systemInstruction: 'x', contents: ['hello'] }));
    expect(outcome).toMatchObject({
      name: 'AppError',
      statusCode: 429,
      code: 'GEMINI_QUOTA_EXHAUSTED',
    });

    // No retries: the request must fail fast instead of sleeping on retryAfter.
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors and only throws after exhausting the retry budget', async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce({ status: 503, message: 'service unavailable' })
      .mockRejectedValueOnce({ status: 429, message: 'too many requests' })
      .mockRejectedValueOnce({ status: 503, message: 'service unavailable' })
      .mockRejectedValueOnce({ status: 503, message: 'service unavailable' });

    const call = capture(generateJson({ systemInstruction: 'x', contents: ['hello'] }));

    // Backoffs are 1000ms, 2000ms, 3000ms (capped); the final attempt throws.
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(3000);

    const outcome = await call;
    expect(outcome).toMatchObject({ status: 503 });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('caps the transient backoff so requests never hang for the API-suggested long delay', async () => {
    vi.useFakeTimers();
    process.env.GEMINI_MAX_RETRIES = '5';
    for (let i = 0; i < 6; i += 1) {
      generateContent.mockRejectedValueOnce({ status: 429, message: 'too many requests' });
    }

    const call = capture(generateJson({ systemInstruction: 'x', contents: ['hello'] }));

    // After 1s + 2s + 3s + 3s + 3s the retry budget is spent; nothing should
    // wait on the API's "retry in ~58s" hint.
    await vi.advanceTimersByTimeAsync(12_000);

    const outcome = await call;
    expect(outcome).toBeTruthy();
    expect(generateContent).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
  });
});
