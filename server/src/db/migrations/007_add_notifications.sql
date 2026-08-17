-- Add notifications and notification_preferences tables for Phase 10.

create table public.notifications (
  id integer generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (char_length(trim(type)) between 1 and 100),
  message text not null check (char_length(trim(message)) between 1 and 500),
  data jsonb not null default '{}'::jsonb,
  actor_id uuid references public.users(id) on delete set null,
  read boolean not null default false,
  created_at timestamp without time zone not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  friend_requests boolean not null default true,
  friend_acceptances boolean not null default true,
  post_likes boolean not null default true,
  post_comments boolean not null default true,
  review_likes boolean not null default true,
  schedule_shares boolean not null default true,
  registration_reminders boolean not null default true
);

create index notifications_user_read_index on public.notifications (user_id, read, created_at desc);
