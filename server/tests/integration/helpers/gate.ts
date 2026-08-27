/**
 * Gate helpers for gated integration tests. Each returns a plain boolean so
 * `describe.runIf(...)` can decide whether a suite executes, and every check
 * fails gracefully (never throws) when the environment is unavailable.
 */

export async function checkSupabaseClient(): Promise<boolean> {
  try {
    const { checkSupabaseConnection } = await import('../../../src/db/supabase.js');
    const status = await checkSupabaseConnection();
    return status === 'connected';
  } catch {
    return false;
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
