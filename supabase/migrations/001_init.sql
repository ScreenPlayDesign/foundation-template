-- 001_init.sql — SPD Event App template
--
-- Starting point for every client project's own database. Intentionally
-- minimal: one example table with RLS enabled, demonstrating the SPD
-- conventions (uuid pks, timestamptz, updated_at trigger, RLS on by default).
-- Client user stories drive everything after this.

create extension if not exists "pgcrypto";

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Example: announcements shown on the landing page
create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_announcements_updated_at
  before update on announcements
  for each row execute function touch_updated_at();

alter table announcements enable row level security;

create policy "announcements: public read published"
  on announcements for select using (published = true);
