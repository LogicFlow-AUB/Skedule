-- 011_add_terms_columns_and_term_courses.sql
-- Extends `terms` with the AUB external code + human-readable description, and
-- adds a `term_courses` join table describing which courses are offered in each
-- term. `sections` still owns the term-specific section offering; `term_courses`
-- is the canonical "course X is offered in term Y" listing used by the
-- term-scoped offered-course endpoint.

-- ─── A. Add code / description / timestamps to terms ──────────────────
ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS code        text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Backfill `code` from the existing `name` column, which historically held the
-- AUB numeric code (e.g. '202710').
UPDATE public.terms SET code = name WHERE code IS NULL;

-- Enforce uniqueness of the external code (only where present).
CREATE UNIQUE INDEX IF NOT EXISTS terms_code_unique
  ON public.terms (code) WHERE code IS NOT NULL;

-- ─── B. term_courses join table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.term_courses (
  term_id   integer NOT NULL REFERENCES public.terms(id)   ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_term_courses_course_id
  ON public.term_courses (course_id);
