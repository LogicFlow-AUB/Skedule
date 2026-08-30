-- Convert study_group_messages.created_at to timestamptz so timestamps are
-- stored as an absolute UTC instant and returned to clients with a timezone
-- marker (e.g. "...+00:00"). Previously it was `timestamp without time zone`;
-- the server session timezone (UTC) wrote UTC wall-clock values into a naive
-- column, so the API returned timezone-less strings that JavaScript parsed as
-- browser-local time, shifting displayed times by the browser's UTC offset
-- (e.g. 3 hours in a UTC+3 timezone).
--
-- Existing naive values were written as UTC wall-clock time, so reinterpreting
-- them as UTC (AT TIME ZONE 'UTC') preserves the same instant that was stored.
ALTER TABLE public.study_group_messages
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
