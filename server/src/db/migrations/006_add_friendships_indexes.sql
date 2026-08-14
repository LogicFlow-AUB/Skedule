-- Add lookup indexes required by the Phase 9 friend APIs. The friendships
-- table (id, user_id, friend_id, status, created_at) already exists.

create unique index if not exists friendships_user_id_friend_id_key
  on public.friendships (user_id, friend_id);

create index if not exists friendships_friend_id_index
  on public.friendships (friend_id);

create index if not exists friendships_user_id_index
  on public.friendships (user_id);
