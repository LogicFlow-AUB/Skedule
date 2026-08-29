/**
 * Shared helpers for deciding which registration terms the server actually
 * loads and syncs, and how the term selector is ordered.
 *
 * AUB exposes a long tail of past/online/activity terms. We only keep the
 * academic terms: the Club/activity and Online terms are excluded, and the rest
 * are ordered newest-first by the numeric AUB code (AUB codes encode year +
 * session, so descending numeric order is newest-first). AUB does not expose
 * academic dates, so ordering by number is the source of truth.
 *
 * `termsInSyncWindow` keeps only the most recent `SYNC_TERM_WINDOW` terms (the
 * ones whose sections are actually fetched), while `sortTermsNewestFirst` is
 * used by the term selector so the user can browse a wider set of upcoming
 * terms. Terms that fall outside the sync window are left untouched in the
 * database (never deleted, never re-synced) so their data stays frozen.
 */

export const SYNC_TERM_WINDOW = 5;

export type TermWindowItem = {
  code: string | null | undefined;
  description?: string | null;
};

/** AUB's non-academic activity and online term(s): "Clubs <year>" and "Online <year>". */
export function isNonAcademicTerm(item: TermWindowItem): boolean {
  const text = `${item.description ?? ''} ${item.code ?? ''}`;
  return /club/i.test(text) || /online/i.test(text);
}

function numericCode(code: string | null | undefined): number {
  const n = Number(code);
  return Number.isFinite(n) ? n : -Infinity;
}

/**
 * Returns the academic terms only (clubs/online dropped), sorted newest-first
 * by numeric code. Used by the term selector.
 */
export function sortTermsNewestFirst<T extends TermWindowItem>(terms: T[]): T[] {
  return terms
    .filter((term) => !isNonAcademicTerm(term))
    .slice()
    .sort((a, b) => numericCode(b.code) - numericCode(a.code));
}

/**
 * The top `window` (default 5) academic terms, newest-first by numeric code.
 * These are the terms whose sections are actually fetched/synced.
 */
export function termsInSyncWindow<T extends TermWindowItem>(
  terms: T[],
  window = SYNC_TERM_WINDOW,
): T[] {
  return sortTermsNewestFirst(terms).slice(0, window);
}
