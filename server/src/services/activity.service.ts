import { requireSupabaseClient } from '../db/supabase.js';

export async function trackActivity(
  userId: string,
  type: string,
  message: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const db = requireSupabaseClient();
  const { error } = await db.from('activities').insert({
    user_id: userId,
    type,
    message,
    data,
  });

  if (error) {
    throw error;
  }
}
