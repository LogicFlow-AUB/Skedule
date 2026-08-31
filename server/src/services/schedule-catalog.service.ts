/**
 * Catalog lookups for the schedule optimizer UI.
 *
 * These endpoints feed the optimizer's dropdowns (planning terms, required
 * attributes) and its offered-course search (courses offered in a selected
 * term, with the professors teaching them). No scheduling / MILP logic lives
 * here: the actual optimization is handled by `schedule-optimizer.service.ts`.
 */

import { requireSupabaseClient } from '../db/supabase.js';
import { sortTermsNewestFirst } from './term-window.js';

type TermRow = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};
type AttributeRow = { id: number; name: string };

export type OptimizerTermOption = {
  id: number;
  name: string;
  code?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
};

export type OptimizerAttributeOption = { id: number; name: string };

/** Maps DB term rows to the optimizer options, newest-first, clubs/online excluded. */
function toTermOptions(rows: TermRow[]): OptimizerTermOption[] {
  return sortTermsNewestFirst(rows).map((term) => {
    const option: OptimizerTermOption = { id: term.id, name: term.name };
    if (term.code) option.code = term.code;
    if (term.description) option.description = term.description;
    if (term.start_date) option.start_date = term.start_date;
    if (term.end_date) option.end_date = term.end_date;
    return option;
  });
}

/** Returns the planning terms and required attributes for the optimizer UI. */
export async function listOptimizerOptions(): Promise<{
  terms: OptimizerTermOption[];
  attributes: OptimizerAttributeOption[];
}> {
  const db = requireSupabaseClient();
  const [termsResult, attributesResult] = await Promise.all([
    db.from('terms').select('id, name, code, description, start_date, end_date'),
    db.from('attributes').select('id, name'),
  ]);
  if (termsResult.error) throw termsResult.error;
  if (attributesResult.error) throw attributesResult.error;

  const terms = toTermOptions((termsResult.data ?? []) as TermRow[]);

  const attributes = ((attributesResult.data ?? []) as AttributeRow[]).map((attribute) => ({
    id: attribute.id,
    name: attribute.name,
  }));

  return { terms, attributes };
}

/**
 * Lists the available planning terms. The term selector uses the
 * human-readable `description` when present (falling back to the code), and
 * `code` is the stable external AUB identifier.
 */
export async function listTerms(): Promise<OptimizerTermOption[]> {
  const db = requireSupabaseClient();
  const { data, error } = await db
    .from('terms')
    .select('id, name, code, description, start_date, end_date');
  if (error) throw error;

  return toTermOptions((data ?? []) as TermRow[]);
}

