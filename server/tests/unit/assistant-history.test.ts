import { beforeEach, describe, expect, it } from 'vitest';

import {
  appendHistory,
  clearSessionHistory,
  getSessionHistory,
  historyToGeminiContents,
  MAX_HISTORY_MESSAGES,
} from '../../src/services/assistant.service.js';

describe('session chat history', () => {
  beforeEach(() => {
    clearSessionHistory('hist-test');
  });

  it('stores messages chronologically', () => {
    appendHistory('hist-test', { role: 'user', content: 'first question' });
    appendHistory('hist-test', { role: 'assistant', content: 'first answer' });
    appendHistory('hist-test', { role: 'user', content: 'second question' });

    const history = getSessionHistory('hist-test');
    expect(history.map((m) => [m.role, m.content])).toEqual([
      ['user', 'first question'],
      ['assistant', 'first answer'],
      ['user', 'second question'],
    ]);
  });

  it('prunes history beyond the max message count (FIFO)', () => {
    for (let i = 0; i < MAX_HISTORY_MESSAGES + 5; i += 1) {
      appendHistory('hist-test', { role: 'user', content: `msg ${i}` });
    }
    const history = getSessionHistory('hist-test');
    expect(history).toHaveLength(MAX_HISTORY_MESSAGES);
    // Oldest dropped, newest retained.
    expect(history[0]?.content).toBe('msg 5');
    expect(history.at(-1)?.content).toBe(`msg ${MAX_HISTORY_MESSAGES + 4}`);
  });

  it('maps history into Gemini contents (user→user, assistant→model)', () => {
    appendHistory('hist-test', { role: 'user', content: 'hi' });
    appendHistory('hist-test', { role: 'assistant', content: 'hello' });
    appendHistory('hist-test', { role: 'user', content: 'again' });

    const contents = historyToGeminiContents(getSessionHistory('hist-test'));
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: 'hello' }] },
      { role: 'user', parts: [{ text: 'again' }] },
    ]);
  });

  it('exposes a defensive copy via getSessionHistory', () => {
    appendHistory('hist-test', { role: 'user', content: 'a' });
    const snapshot = getSessionHistory('hist-test');
    snapshot[0]!.content = 'tampered';
    expect(getSessionHistory('hist-test')[0]?.content).toBe('a');
  });
});
