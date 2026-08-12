-- Add only the schedule and section fields required by the Phase 7 schedule APIs.

alter table public.schedules
  add column if not exists name text,
  add column if not exists notes text,
  add column if not exists term_id integer references public.terms(id) on delete set null,
  add column if not exists updated_at timestamp without time zone not null default now();

alter table public.sections
  add column if not exists days text,
  add column if not exists start_time time without time zone,
  add column if not exists end_time time without time zone,
  add column if not exists room text;

create unique index if not exists schedule_sections_schedule_id_section_id_key
  on public.schedule_sections (schedule_id, section_id);

create index if not exists schedules_user_id_created_at_index
  on public.schedules (user_id, created_at desc);
