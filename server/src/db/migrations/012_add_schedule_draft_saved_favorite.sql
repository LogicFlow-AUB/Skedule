-- 012_add_schedule_draft_saved_favorite.sql
-- Extends `schedules` to model persistent drafts vs. saved schedules and a
-- single per-user favorite, minimal extension of the existing schedule model.
--
--   saved       boolean  false = a working/current draft; true = a saved schedule
--   is_favorite boolean  true for at most one saved schedule per user
--
-- Constraints enforced here:
--   * A user can have at most ONE favorite schedule.
--   * A user can have at most ONE draft (saved=false) PER TERM. Drafts carry
--     the term they belong to, so Fall / Spring drafts never get mixed.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS saved       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

-- Backfill: rows that existed before this feature were all "saved" schedules,
-- never working drafts (drafts are a brand-new concept introduced alongside this
-- migration). Promoting them to saved=true keeps pre-existing schedules out of
-- the draft unique index so they don't collide on the (user,term) bucket.
UPDATE public.schedules
SET saved = true
WHERE saved IS FALSE;

-- At most one favorite schedule per user.
CREATE UNIQUE INDEX IF NOT EXISTS schedules_one_favorite_per_user
  ON public.schedules (user_id)
  WHERE is_favorite IS TRUE;

-- At most one draft per (user, term). Terms with NULL term_id share bucket 0,
-- preserving the legacy behaviour for drafts without a term.
CREATE UNIQUE INDEX IF NOT EXISTS schedules_one_draft_per_user_term
  ON public.schedules (user_id, COALESCE(term_id, 0))
  WHERE saved IS FALSE;
