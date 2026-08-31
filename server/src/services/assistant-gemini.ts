/**
 * Shared Gemini client for the AI assistant.
 *
 * Responsibility is limited to talking to Gemini. Each stage of the assistant
 * (router, query generation, final answer, optimizer extraction) supplies its
 * own system instruction and strict JSON expectations; this module only
 * guarantees the call, retry behavior, and JSON extraction.
 */

import { GoogleGenAI } from '@google/genai';

import config from '../config.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

const genai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

const MAX_TRANSIENT_RETRIES = 3;

export function getGeminiClient() {
  if (!genai) {
    throw new AppError(
      503,
      'GEMINI_UNAVAILABLE',
      'AI assistant is not configured. Set GEMINI_API_KEY in your environment.',
    );
  }

  return genai;
}

export type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

export type GeminiCallOptions = {
  systemInstruction: string;
  contents: Array<string | GeminiContent>;
  temperature?: number;
};

async function generateContentWithRetry(
  options: Parameters<NonNullable<typeof genai>['models']['generateContent']>[0],
): Promise<ReturnType<NonNullable<typeof genai>['models']['generateContent']>> {
  const maxRetries = Number(process.env.GEMINI_MAX_RETRIES ?? MAX_TRANSIENT_RETRIES);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await getGeminiClient().models.generateContent(options);
    } catch (error) {
      const errorLike = error as { status?: number; message?: string };
      const status = errorLike.status;

      // Daily-quota exhaustion ("Quota exceeded ... RESOURCE_EXHAUSTED"):
      // the API's suggested "Please retry in Ns" only reflects the per-minute
      // bucket and will NOT restore the daily quota. Fail fast with a
      // user-facing message instead of hanging the chat request for minutes.
      if (
        status === 429 &&
        /quota exceeded|resource_exhausted|quota/i.test(errorLike.message ?? '')
      ) {
        throw new AppError(
          429,
          'GEMINI_QUOTA_EXHAUSTED',
          'The AI assistant has reached its request quota for now.',
        );
      }

      const isTransient = status === 429 || status === 503;
      if (!isTransient || attempt === maxRetries) throw error;

      // Back off briefly and retry. The backoff is capped so a burst of
      // 429/503 responses never leaves the request pending for a long time.
      const backoffMs = Math.min(1000 * 2 ** attempt, 3000);
      logger.warn({ status, attempt, retryAfterMs: backoffMs }, 'Transient Gemini error; retrying');
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error('Unreachable');
}

function extractText(response: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  return text ?? '';
}

/** Strips a ```json ... ``` (or ``` ... ```) wrapper if the model adds one. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function buildListContents(parts: Array<string | GeminiContent>): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      contents.push({ role: 'user', parts: [{ text: part }] });
      continue;
    }
    contents.push(part);
  }
  return contents;
}

/**
 * Calls Gemini and insists on a single JSON object in the response.
 * Throws AppError with PROMPT_JSON_INVALID when the output cannot be parsed.
 */
export async function generateJson<T>(options: GeminiCallOptions): Promise<T> {
  const contents = buildListContents(options.contents);

  const response = await generateContentWithRetry({
    model: config.gemini.model,
    contents: contents as never,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature ?? 0,
      responseMimeType: 'application/json',
    },
  });

  const text = extractText(response);

  try {
    return JSON.parse(stripCodeFences(text)) as T;
  } catch {
    logger.warn({ snippet: text.slice(0, 200) }, 'Gemini returned malformed JSON');
    throw new AppError(
      422,
      'PROMPT_JSON_INVALID',
      'The model returned an unparsable structured response.',
    );
  }
}

/** Calls Gemini and returns the plain text answer. */
export async function generateText(options: GeminiCallOptions): Promise<string> {
  const contents = buildListContents(options.contents);

  const response = await generateContentWithRetry({
    model: config.gemini.model,
    contents: contents as never,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature ?? 0,
    },
  });

  return extractText(response);
}
