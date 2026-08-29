import { requireSupabaseClient } from '../db/supabase.js';

export type ProfileVisibility = 'public' | 'friends_only' | 'private';

/**
 * Canonical values stored on the users table. The wire/API layer translates
 * between these and the public-facing `'public' | 'friends' | 'private'` shape.
 */
export const PROFILE_VISIBILITIES: readonly ProfileVisibility[] = [
  'public',
  'friends_only',
  'private',
];

export function isProfileVisibility(value: string | null | undefined): value is ProfileVisibility {
  return value === 'public' || value === 'friends_only' || value === 'private';
}

/**
 * Decides whether an author's real name may be shown to a viewer.
 * - The author's own content is always shown to themselves.
 * - public      -> everyone sees the name.
 * - friends_only-> only friends see the name.
 * - private     -> nobody (including friends) sees the name.
 */
export function revealAuthorName(options: {
  visibility: ProfileVisibility;
  isOwnContent: boolean;
  isFriend: boolean;
}): boolean {
  if (options.isOwnContent) {
    return true;
  }
  if (options.visibility === 'public') {
    return true;
  }
  if (options.visibility === 'friends_only') {
    return options.isFriend;
  }
  return false;
}

export type RevealableAuthor = { id: string; profile_visibility: string | null };

/**
 * Computes the set of author ids whose real name may be revealed to `viewerId`.
 * Uses the existing `friendships` table (accepted rows only) to determine
 * friendship and the author's own `profile_visibility` column. When no viewer
 * is authenticated, non-public authors are never revealed.
 */
export async function getRevealedAuthorIds(
  authors: RevealableAuthor[],
  viewerId: string | undefined,
): Promise<Set<string>> {
  const unique = new Map<string, RevealableAuthor>();
  for (const author of authors) {
    unique.set(author.id, author);
  }

  const ids = [...unique.keys()];
  if (ids.length === 0) {
    return new Set();
  }

  const viewer = viewerId ?? null;
  const friendIds = new Set<string>();

  if (viewer) {
    const db = requireSupabaseClient();
    const { data, error } = await db
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${viewer},friend_id.eq.${viewer}`)
      .eq('status', 'accepted');

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as { user_id: string; friend_id: string }[]) {
      friendIds.add(row.user_id === viewer ? row.friend_id : row.user_id);
    }
  }

  const revealed = new Set<string>();
  for (const author of unique.values()) {
    const visibility = isProfileVisibility(author.profile_visibility) ? author.profile_visibility : 'public';
    if (revealAuthorName({ visibility, isOwnContent: author.id === viewer, isFriend: friendIds.has(author.id) })) {
      revealed.add(author.id);
    }
  }

  return revealed;
}
