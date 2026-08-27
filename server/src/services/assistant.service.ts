/**
 * AI assistant orchestrator.
 *
 * A user message is sent to a router, which selects exactly one of two routes:
 *
 *   - "assistant"  → Gemini proposes a structured read-only database query,
 *                    the backend validates & executes it, then Gemini writes a
 *                    natural-language answer.
 *   - "optimizer"  → the request is prepared into a structured optimizer
 *                    contract and handed to the schedule-optimizer backend.
 *
 * The router performs no database work and no optimization itself.
 */

import { AppError } from '../utils/app-error.js';
import { routeMessage, type AssistantRoute } from './assistant-router.js';
import { runAssistantRoute } from './assistant-route.js';
import { runOptimizerRoute } from './assistant-optimizer.js';
import type { GeminiContent } from './assistant-gemini.js';
import { logger } from '../utils/logger.js';

// ── session-based (in-memory) conversation history ────────────────────────
export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

export const MAX_HISTORY_MESSAGES = 30;

const sessionHistories = new Map<string, ConversationMessage[]>();

export function getHistory(sessionId: string): ConversationMessage[] {
  return sessionHistories.get(sessionId) ?? [];
}

export function appendHistory(sessionId: string, message: ConversationMessage): void {
  const history = getHistory(sessionId);
  history.push(message);
  if (history.length > MAX_HISTORY_MESSAGES) {
    history.splice(0, history.length - MAX_HISTORY_MESSAGES);
  }
  sessionHistories.set(sessionId, history);
}

export function historyToGeminiContents(history: ConversationMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const entry of history) {
    if (entry.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: entry.content }] });
    } else if (entry.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: entry.content }] });
    }
  }
  return contents;
}

// ── entry point ────────────────────────────────────────────────────────────

export type AssistantResponse = {
  response: string;
  route: AssistantRoute;
};

/** Returns a user-safe answer message for a known assistant-stage failure. */
function gracefulFailureMessage(error: AppError): string | null {
  switch (error.code) {
    case 'USER_SCOPE_VIOLATION':
      return "I can't access another user's private information.";
    case 'QUERY_REJECTED':
    case 'PROMPT_JSON_INVALID':
      return "I couldn't understand that request. Try asking about courses, professors, sections, reviews, or schedules.";
    case 'GEMINI_QUOTA_EXHAUSTED':
      return 'The AI assistant has reached its daily request quota. Please try again later.';
    case 'QUERY_EXECUTION_FAILED':
      return 'I had trouble reaching the data service. Please try again in a moment.';
    case 'ANSWER_GENERATION_FAILED':
      return 'I found the requested data but could not summarize it. Please try again.';
    default:
      // QUERY_GENERATION_FAILED / OPTIMIZER_EXTRACTION_FAILED carry a useful message.
      return error.message;
  }
}

/**
 * Processes a user message within a per-session in-memory conversation.
 */
export async function handleMessage(
  message: string,
  userId: string,
  sessionId: string,
): Promise<AssistantResponse> {
  appendHistory(sessionId, { role: 'user', content: message, timestamp: Date.now() });

  const history = historyToGeminiContents(getHistory(sessionId));
  const route = await routeMessage(message);

  let response: string;
  if (route === 'optimizer') {
    try {
      const outcome = await runOptimizerRoute(message, history);
      response = outcome.response;
    } catch (error) {
      if (error instanceof AppError && error.code === 'GEMINI_UNAVAILABLE') {
        throw error;
      }
      if (error instanceof AppError) {
        response = gracefulFailureMessage(error) ?? error.message;
      } else {
        logger.warn({ error: (error as Error).message }, 'Optimizer route failed');
        response = 'I could not prepare that optimization request. Please try again.';
      }
    }
  } else {
    try {
      response = await runAssistantRoute(message, userId, history);
    } catch (error) {
      if (error instanceof AppError && error.code === 'GEMINI_UNAVAILABLE') {
        throw error;
      }
      if (error instanceof AppError) {
        response = gracefulFailureMessage(error) ?? error.message;
      } else {
        logger.warn({ error: (error as Error).message }, 'Assistant route failed');
        response = 'I could not answer that right now. Please try again.';
      }
    }
  }

  appendHistory(sessionId, { role: 'assistant', content: response, timestamp: Date.now() });

  return { response, route };
}

/** Returns a copy of the conversation history for a session (useful for tests). */
export function getSessionHistory(sessionId: string): ConversationMessage[] {
  return getHistory(sessionId).map((entry) => ({ ...entry }));
}

/** Clears in-memory history for a session (useful for tests). */
export function clearSessionHistory(sessionId: string): void {
  sessionHistories.delete(sessionId);
}
