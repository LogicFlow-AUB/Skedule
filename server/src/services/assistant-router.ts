/**
 * LLM router for the assistant.
 *
 * The router decides between exactly two destinations: `assistant` (database
 * information retrieval) and `optimizer` (schedule optimization). It never
 * queries the database, never optimizes schedules, and never attempts to
 * answer the user — it only picks a route.
 */

import { generateJson } from './assistant-gemini.js';
import { logger } from '../utils/logger.js';

export type AssistantRoute = 'assistant' | 'optimizer';

export const VALID_ROUTES: readonly AssistantRoute[] = ['assistant', 'optimizer'];

const ROUTER_SYSTEM = `You are a routing component of a university scheduling assistant.

Your ONLY job is to decide which backend should handle the user's message. Return a JSON object with exactly one field:

{"route": "assistant"}  or  {"route": "optimizer"}

The ONLY valid values are "assistant" and "optimizer". Never invent other routes.

Choose "optimizer" when the user wants to:
- generate, create, build, or optimize a schedule or timetable
- find the best combination of sections / best schedule
- select courses subject to constraints (credits, free days, preferences)
- optimize credit load, avoid schedule conflicts, minimize gaps
- compute an optimal schedule from preferences

Examples of "optimizer":
- "Find me the best schedule with no Friday classes."
- "Create my Fall schedule with 15 credits."
- "Optimize my courses to minimize gaps."
- "Build a timetable without morning classes."

EVERYTHING ELSE goes to "assistant":
- course / professor / section / review / event / study-group questions
- schedule INFORMATION questions (what is in my schedule)
- policy or general questions

Examples of "assistant":
- "What sections are available for CMPS 202?"
- "Who teaches CMPS 202?"
- "What is the average professor rating?"
- "Show me PHIL courses."
- "Show me my saved schedules."
- "What is the deadline to drop a course?"

Respond with ONLY the JSON object. No prose, no markdown.`;

const OPTIMIZER_PATTERNS = [
  /optimiz|optimal/i,
  /minimi[sz]?e.*gaps/i,
  /avoid.*conflict/i,
  /no.*(friday|saturday|sunday).*(class|course)/i,
  /(class|course).*on.*(friday|saturday|sunday)/i,
  /create.*(schedule|timetable|plan)/i,
  /build.*(schedule|timetable)/i,
  /make.*(schedule|timetable|plan)/i,
  /generate.*(schedule|timetable|plan)/i,
  /best.*(schedule|timetable|combination)/i,
  /(schedule|timetable).*(best|optim)/i,
  /credit.*(load|limit)/i,
  /(d+)\s*credits/i,
  /\b(min|max|at least|no more than)\b.*\bcredits\b/i,
  /free day/i,
  /(reduce|minimize).*(credits|classes)/i,
  /\b\d+\s*(credits|units)/i,
];

/**
 * Deterministic fallback used when the router LLM fails or returns
 * malformed/invalid output. Defaults to `assistant` unless the message clearly
 * requests schedule optimization.
 */
export function fallbackRoute(message: string): AssistantRoute {
  const normalized = ` ${message.trim().toLowerCase()} `;

  for (const pattern of OPTIMIZER_PATTERNS) {
    if (pattern.test(normalized)) {
      return 'optimizer';
    }
  }

  return 'assistant';
}

export function isRoute(value: unknown): value is AssistantRoute {
  return value === 'assistant' || value === 'optimizer';
}

/**
 * Routes a message to either `assistant` or `optimizer`.
 *
 * If the router LLM is unavailable or returns malformed/invalid output, this
 * safely falls back to a deterministic classifier (defaulting to `assistant`).
 */
export async function routeMessage(message: string): Promise<AssistantRoute> {
  try {
    const payload = await generateJson<{ route?: unknown }>({
      systemInstruction: ROUTER_SYSTEM,
      contents: [message],
    });

    if (isRoute(payload?.route)) {
      return payload.route;
    }

    logger.warn({ route: payload?.route }, 'Router returned an invalid route; falling back');
  } catch (error) {
    logger.warn({ error: (error as Error).message }, 'Router LLM failed; using fallback route');
  }

  return fallbackRoute(message);
}