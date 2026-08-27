/**
 * Final natural-language answer generation for the assistant route.
 *
 * Gemini receives: the conversation context, the user's original question, and
 * the normalized (structured) database results. It must answer from the data
 * only — never inventing missing courses, professors, sections, or ratings.
 */

import { generateText, type GeminiContent } from './assistant-gemini.js';

const ANSWER_SYSTEM = `You are the natural-language front end of a university scheduling and information assistant for LogicFlow.

The user asked a question. You are given structured database results that were fetched on their behalf. Write a concise, helpful answer based ONLY on those results.

Rules:
- Answer the user's question directly. Use the structured results as the facts.
- Summarize and explain the relevant information (e.g. section times, professors, availability, averages). Never dump raw internal database structures.
- If a numeric average was requested, use the provided average values; never compute a different number by hand from partial rows.
- If the results are EMPTY, say clearly that no matching data was found. Do not invent courses, professors, sections, schedules, reviews, or events.
- Do not claim information that is not present in the results.
- Do not mention SQL, Supabase, tables, or internal implementation details.
- Mention things like meeting days/times, section numbers, seats, and professor names only when present in the results.
- Keep the answer short and well-structured.`;

export type AnswerInput = {
  question: string;
  results: { rows: Record<string, unknown>[]; stats?: { count: number; avgRating?: number | null; avgDifficulty?: number | null; avgWorkload?: number | null; wouldRetakePercentage?: number | null } };
  history: GeminiContent[];
};

export async function generateAssistantAnswer(input: AnswerInput): Promise<string> {
  const resultsText = JSON.stringify(input.results);

  const contents: GeminiContent[] = [
    ...input.history.slice(-8),
    {
      role: 'user',
      parts: [
        {
          text: `The most recent user question was:\n"${input.question}"\n\nStructured database results:\n${resultsText}\n\nWrite your answer now.`,
        },
      ],
    },
  ];

  return generateText({
    systemInstruction: ANSWER_SYSTEM,
    contents,
  });
}