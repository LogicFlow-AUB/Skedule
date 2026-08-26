-- 010_fix_meeting_schema.sql
-- Adds section_meetings table, link_identifier, day booleans, and backfills
-- existing data from the legacy `days` text column.

-- ─── A. Add new columns to sections ───────────────────────────────────
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS link_identifier text;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS meeting_schedule_type text;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS has_monday    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_tuesday   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_wednesday boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_thursday  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_friday    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_saturday  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_sunday    boolean NOT NULL DEFAULT false;

-- ─── B. Create section_meetings ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.section_meetings (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id    integer NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  term_id       integer NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,

  monday        boolean NOT NULL DEFAULT false,
  tuesday       boolean NOT NULL DEFAULT false,
  wednesday     boolean NOT NULL DEFAULT false,
  thursday      boolean NOT NULL DEFAULT false,
  friday        boolean NOT NULL DEFAULT false,
  saturday      boolean NOT NULL DEFAULT false,
  sunday        boolean NOT NULL DEFAULT false,

  start_time    time without time zone,
  end_time      time without time zone,
  building      text,
  room          text,
  meeting_type  text,
  hours_week    numeric,
  start_date    date,
  end_date      date,

  created_at    timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_section_meetings_section_id
  ON public.section_meetings (section_id);

CREATE INDEX IF NOT EXISTS idx_section_meetings_term_id
  ON public.section_meetings (term_id);

-- ─── C. Backfill section_meetings from existing sections ──────────────
INSERT INTO public.section_meetings (
  section_id, term_id,
  monday, tuesday, wednesday, thursday, friday, saturday, sunday,
  start_time, end_time, room
)
SELECT
  s.id,
  COALESCE(s.term_id, 1),
  (s.days ~ 'M'),
  (s.days ~ 'T'),
  (s.days ~ 'W'),
  (s.days ~ 'R'),
  (s.days ~ 'F'),
  false,
  false,
  s.start_time,
  s.end_time,
  s.room
FROM public.sections s
WHERE s.days IS NOT NULL
  AND s.days <> ''
  AND s.term_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.section_meetings m WHERE m.section_id = s.id
  );

-- ─── D. Backfill has_* boolean flags on sections from days text ────────
UPDATE public.sections
SET
  has_monday    = (days ~ 'M'),
  has_tuesday   = (days ~ 'T'),
  has_wednesday = (days ~ 'W'),
  has_thursday  = (days ~ 'R'),
  has_friday    = (days ~ 'F'),
  has_saturday  = false,
  has_sunday    = false
WHERE days IS NOT NULL;
