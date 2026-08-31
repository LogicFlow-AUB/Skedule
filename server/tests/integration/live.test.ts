/**
 * Live integration test that hits the LIVE Gemini API through the assistant
 * orchestrator. It is gated: it skips cleanly when no Gemini API key is present
 * and treats quota exhaustion (429) as a skip rather than a failure. It never
 * depends on a working network for the core assertion suite and performs no
 * database work.
 */
import { describe, expect, it } from 'vitest';

import { isGeminiConfigured } from './helpers/gate.js';

const gemini = isGeminiConfigured();

describe.runIf(gemini)('live Gemini: agent E2E (skips when quota is exhausted)', () => {
  it('answers a relationship-style question about MATH 201', async () => {
    const { handleMessage } = await import('../../src/services/assistant.service.js');
    // Disable automatic transient retries: if the free-tier quota is exhausted
    // we want the call to fail fast so the test can skip cleanly.
    process.env.GEMINI_MAX_RETRIES = '0';
    try {
      const reply = await handleMessage(
        'Find MATH 201 and give me one lecture with the recitations linked to it',
        'live-e2e-test',
        'live-e2e-session',
      );
      expect(typeof reply.response).toBe('string');
      expect(reply.response.length).toBeGreaterThan(0);
    } catch (err) {
      // Free-tier daily quota is commonly exhausted; treat as a skip, not a failure.
      if (
        String((err as Error)?.message ?? err).match(
          /429|quota|resource exhausted|TOO_MANY_REQUESTS/i,
        )
      ) {
        console.warn('[live] Gemini quota exhausted; skipping E2E.');
      } else {
        throw err;
      }
    }
  });
});
