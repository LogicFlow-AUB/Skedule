import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import config from '../config.js';
import type { SupabaseConnectionStatus } from '../types.js';
import { AppError } from '../utils/app-error.js';

/**
 * Creates a Supabase client that always uses the service role key for database
 * operations. This client must NEVER be used for auth calls (signUp, signIn,
 * etc.) because those mutate the client's in-memory session, which would cause
 * subsequent DB queries to use the user's token instead of the service role key.
 */
function createAdminClient(): SupabaseClient | undefined {
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

/**
 * Creates a Supabase client for auth operations only (signUp, signIn, etc.).
 * Its internal session state is intentionally allowed to change since it is
 * only used for auth flows, never for database queries.
 */
function createAuthClient(): SupabaseClient | undefined {
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

export const supabase = createAdminClient();

/** Auth client — used only for auth API calls. */
export const authClient = createAuthClient() ?? supabase;

export function requireSupabaseClient() {
  if (!supabase) {
    throw new AppError(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not configured.');
  }

  return supabase;
}

export function requireAuthClient() {
  if (!authClient) {
    throw new AppError(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not configured.');
  }

  return authClient;
}

/**
 * A fresh, throwaway client for GoTrue calls that establish a session
 * (signUp, signInWithPassword, refreshSession, verifyOtp). These calls
 * mutate the client's in-memory session, so running them on the shared
 * `supabase` client would silently swap its service-role access for the
 * signed-in user's session on every later query. Each call gets its own
 * client instead, leaving the shared client's service-role access intact.
 */
export function createAuthClient() {
  const { anonKey, url } = config.supabase;

  if (!url || !anonKey) {
    throw new AppError(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not configured.');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
        apikey: serviceRoleKey ?? anonKey,
        Authorization: `Bearer ${serviceRoleKey ?? anonKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    return response.ok ? 'connected' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
