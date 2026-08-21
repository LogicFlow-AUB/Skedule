-- 009_add_aub_sync_constraints.sql
-- NOT APPLIED — reference only, run manually against Supabase

-- Remove duplicate sections, keeping the one with the lowest id per (term_id, crn)
DELETE FROM public.sections
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.sections
  GROUP BY term_id, crn
);

-- Ensure one section per CRN per term (prevents duplicate sections on sync)
ALTER TABLE public.sections
  ADD CONSTRAINT sections_term_id_crn_unique UNIQUE (term_id, crn);

-- Remove duplicate courses, keeping the one with the lowest id per (subject, course_number)
DELETE FROM public.courses
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.courses
  GROUP BY subject, course_number
);

-- Ensure one course per subject + course_number (prevents duplicate courses on sync)
ALTER TABLE public.courses
  ADD CONSTRAINT courses_subject_course_number_unique UNIQUE (subject, course_number);
