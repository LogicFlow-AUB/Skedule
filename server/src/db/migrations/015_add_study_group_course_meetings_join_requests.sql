-- Study group enhancements: course relationship, recurring meeting schedule,
-- and pending join requests.

-- Extend study_groups with a relationship to the existing courses table rather
-- than storing duplicate course text, and with recurring meeting day(s)/times.
ALTER TABLE public.study_groups
  ADD COLUMN IF NOT EXISTS course_id integer REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_days integer[] CHECK (meeting_days IS NULL OR array_length(meeting_days, 1) BETWEEN 1 AND 7),
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone;

CREATE INDEX IF NOT EXISTS study_groups_course_idx ON public.study_groups (course_id);

-- Pending join requests (many-to-many between users and study groups). A row
-- exists while a student's request is awaiting the group owner's decision.
-- Duplicate pending requests are prevented by the composite primary key.
CREATE TABLE IF NOT EXISTS public.study_group_join_requests (
  study_group_id integer NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (study_group_id, user_id)
);
CREATE INDEX IF NOT EXISTS study_group_join_requests_user_idx ON public.study_group_join_requests (user_id);
