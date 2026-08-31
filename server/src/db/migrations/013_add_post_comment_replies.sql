-- 013_add_post_comment_replies.sql
-- Adds a nullable, self-referencing `parent_comment_id` to `post_comments` to
-- support ONE level of replies: a normal comment can have replies, but a reply
-- itself can never be replied to (enforced by the backend service as well).
--
-- `ON DELETE CASCADE` keeps the hierarchy consistent: deleting a comment also
-- removes all of its replies, so nothing orphaned is left behind.

alter table public.post_comments
  add column if not exists parent_comment_id integer
    references public.post_comments(id) on delete cascade;

create index if not exists post_comments_parent_id_index
  on public.post_comments (parent_comment_id);
