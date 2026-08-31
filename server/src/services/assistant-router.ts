/**
 * LLM router for the assistant.
 *
 * The assistant chat is read-only QA. Generating a new optimized schedule is
 * intentionally left to the AI Scheduler's "Generate Schedule" button, which
 * calls the dedicated /schedule/optimize endpoint — NOT the chat assistant.
 *
 * For that reason the chat router always routes to `assistant`: normal chat
 * must never auto-trigger schedule optimization. The `optimizer` route is kept
 * in the type system only for backwards compatibility with code paths that
 * still reference it, but the router never selects it.
 */

import { logger } from '../utils/logger.js';

export type AssistantRoute = 'assistant' | 'optimizer';

export const VALID_ROUTES: readonly AssistantRoute[] = ['assistant', 'optimizer'];

/**
 * Deterministic router. Always returns `assistant` so chat never auto-routes
 * to the optimizer. Optimizer generation is the sole responsibility of the AI
 * Scheduler's Generate button.
 */
export function fallbackRoute(_message: string): AssistantRoute {
  return 'assistant';
}

export function isRoute(value: unknown): value is AssistantRoute {
  return value === 'assistant' || value === 'optimizer';
}

/**
 * Routes a message. Always returns `assistant`. Kept async to preserve the
 * prior call signature; no LLM routing (or optimizer routing) is performed.
 */
export async function routeMessage(_message: string): Promise<AssistantRoute> {
  logger.info('Assistant chat routed to assistant; optimizer is only triggered by Generate.');
  return 'assistant';
}
