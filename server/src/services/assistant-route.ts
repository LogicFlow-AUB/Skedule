/**
 * Assistant route.
 *
 * Flow:  User message
 *        → Gemini query generator (structured JSON, not SQL)
 *        → strict backend validation
 *        → controlled read-only Supabase execution
 *        → Gemini final-answer generation.
 *
 * The generator is never given direct SQL capability; it only proposes a
 * validated structured query.
 */

import { generateJson, type GeminiContent } from './assistant-gemini.js';
import { generateAssistantAnswer } from './assistant-answer.js';
import { buildQueryFormatInstructions, buildSchemaKnowledge } from './assistant-knowledge.js';
import { executeAssistantQuery } from './assistant-database.js';
import { parseGeneratedQuery, type AssistantQuery } from './assistant-query.js';
import { AppError } from '../utils/app-error.js';

/**
 * Builds the query-planner system prompt. When a term is in view, the model is
 * told that "my current schedule / draft / builder" means the saved=false draft
 * for that term, so it resolves the schedule shown in the calendar correctly
 * instead of reading across all of the user's terms.
 */
function buildGeneratorSystem(termId: number | null): string {
  const base = [
    `You are the query planner of a university information assistant.`,
    `Translate the user's request into a SINGLE structured read-only database query proposed in JSON.`,
    ``,
    buildSchemaKnowledge(),
    buildQueryFormatInstructions(),
    ``,
    `Remember: propose data retrieval only. If the request is conversational or outside the database, output {"intent": "no_query", "query": null}.`,
  ];

  if (termId != null) {
    base.push(
      ``,
      `The user is currently viewing the term with id ${termId} in their schedule builder.`,
      `When they refer to "my current schedule", "my draft", "the schedule in the calendar", or "the builder", query the schedules entity filtered to saved=false AND term_id=${termId}, so you read exactly the schedule shown in the calendar.`,
    );
  }

  return base.join('\n');
}

export type QueryGenerationOutcome =
  | { kind: 'query'; query: AssistantQuery }
  | { kind: 'no_query'; intent: string };

/**
 * Asks the LLM to propose a structured query for the user's request.
 * Returns `{ kind: 'query' }` when a query is proposed, or `{ kind: 'no_query' }`
 * when the model determines the database cannot answer.
 */
export async function proposeAssistantQuery(
  message: string,
  history: GeminiContent[],
  userId: string,
  termId: number | null = null,
): Promise<QueryGenerationOutcome> {
  const contents: GeminiContent[] = [
    ...history.slice(-8),
    {
      role: 'user',
      parts: [
        {
          text: [
            'Recent conversation (for context):',
            history.length ? JSON.stringify(history.slice(-6)) : '(none)',
            '',
            `The user's current request is:`,
            message,
            '',
            'Output the structured JSON query plan now.',
          ].join('\n'),
        },
      ],
    },
  ];

  const raw = await generateJson<{ intent?: unknown; query?: unknown }>({
    systemInstruction: buildGeneratorSystem(termId),
    contents,
  });

  if (raw.query === null || raw.query === undefined) {
    return { kind: 'no_query', intent: typeof raw.intent === 'string' ? raw.intent : 'no_query' };
  }

  const parsed = parseGeneratedQuery(raw, userId);
  return { kind: 'query', query: parsed.query };
}

/**
 * Runs the full assistant route for a message.
 * Throws AppError with a stage-specific code on failure so the orchestrator
 * can render a graceful message.
 */
export async function runAssistantRoute(
  message: string,
  userId: string,
  history: GeminiContent[],
  termId: number | null = null,
): Promise<string> {
  let proposal: QueryGenerationOutcome;
  try {
    proposal = await proposeAssistantQuery(message, history, userId, termId);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      422,
      'QUERY_GENERATION_FAILED',
      'The assistant could not plan a query for that request.',
    );
  }

  if (proposal.kind === 'no_query') {
    throw new AppError(
      400,
      'QUERY_GENERATION_FAILED',
      "I couldn't determine what data to look up for that request. Try rephrasing, for example asking about a course, professor, section, or schedule.",
    );
  }

  let results: { rows: Record<string, unknown>[]; stats?: { count: number; avgRating?: number | null; avgDifficulty?: number | null; avgWorkload?: number | null; wouldRetakePercentage?: number | null } };
  try {
    results = await executeAssistantQuery(proposal.query, userId);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      502,
      'QUERY_EXECUTION_FAILED',
      'I could not retrieve that information right now. Please try again.',
    );
  }

  try {
    return await generateAssistantAnswer({
      question: message,
      results,
      history,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      502,
      'ANSWER_GENERATION_FAILED',
      'I found the requested data but could not summarize it just now.',
    );
  }
}