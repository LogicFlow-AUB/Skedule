-- 014_add_profile_visibility.sql
-- Adds a `profile_visibility` column to `users` (the application profile table)
-- controlling whether a user's real name is shown on their posts and reviews:
--   - public       -> everyone sees the user's name
--   - friends_only -> friends see the name; everyone else sees Anonymous
--   - private      -> everyone (including friends) sees Anonymous
--
-- Existing users default to `public`, preserving current behaviour.

alter table public.users
  add column if not exists profile_visibility text not null default 'public';

alter table public.users
  drop constraint if exists users_profile_visibility_check;

alter table public.users
  add constraint users_profile_visibility_check
  check (profile_visibility in ('public', 'friends_only', 'private'));
