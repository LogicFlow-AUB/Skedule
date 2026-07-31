import { createClient } from '@supabase/supabase-js';

import config from '../config.js';
import type { SupabaseConnectionStatus } from '../types.js';
import { AppError } from '../utils/app-error.js';

/**
 * Server-side Supabase client used for all database and auth access. Prefers
 * the service role key so it bypasses row-level security.
 */
function createSupabaseClient() {
  const { anonKey, serviceRoleKey, url } = config.supabase;

  if (!url || !anonKey) {
    return undefined;
  }

  return createClient(url, serviceRoleKey ?? anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const supabase = createSupabaseClient();

export function requireSupabaseClient() {
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not configured.');
  }

  return supabase;
}

/**
 * Checks that the project's PostgREST endpoint is reachable without assuming a
 * table, column, or RPC function.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const { anonKey, serviceRoleKey, url } = config.supabase;

  if (!url || !anonKey) {
    return 'unconfigured';
  }

  try {
    const response = await fetch(new URL('/rest/v1/', url), {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${serviceRoleKey ?? anonKey}`,
      },
      signal: AbortSignal.timeout(3_000),
    });

    return response.ok ? 'connected' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
