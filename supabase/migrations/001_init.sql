-- 001_init.sql — SPD Foundation Schema · User Accounts + Auth
-- ─────────────────────────────────────────────────────────────────────────────
-- Every SPD project starts here. This migration establishes:
--   · The standard user account schema (profiles, extending auth.users)
--   · Google OAuth as the default identity provider
--   · The billing_plans reference table
--   · Placeholder tables for events and announcements (FACADE — tear out)
--
-- CONVENTIONS used throughout this project:
--   · uuid primary keys via gen_random_uuid()
--   · timestamptz for all datetimes (never plain timestamp without timezone)
--   · updated_at maintained by trigger — never set manually in app code
--   · RLS enabled on every table, deny-by-default
--   · security definer on auth-touching functions (they run as the owner)
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ── Utility: updated_at trigger ──────────────────────────────────────────────
-- Use this for every table. Never maintain updated_at in application code.

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- BILLING PLANS  (reference data — inserted at the end of this migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- This table must exist before profiles can reference it (FK constraint).
-- Plans are project-specific: rename/restructure to match your pricing model.
-- FACADE — the three plans below are illustrative. Replace with your own.

create table billing_plans (
  id                   text primary key,         -- e.g. 'free', 'pro', 'enterprise'
  display_name         text not null,
  price_monthly_cents  int  not null default 0,
  features             text[] not null default '{}',
  is_active            boolean not null default true
);

-- Plans are public information — no auth required.
alter table billing_plans enable row level security;
create policy "billing_plans: public read active"
  on billing_plans for select using (is_active = true);

-- Seed plans inline so the FK default on profiles never fails at signup time.
-- FACADE — replace these with your actual pricing tiers.
insert into billing_plans (id, display_name, price_monthly_cents, features) values
  ('free',       'Free',       0,
   array['5 events/mo', '1 user', 'Community support']),
  ('pro',        'Pro',        1200,
   array['Unlimited events', '5 users', 'Priority support', 'Custom domain']),
  ('enterprise', 'Enterprise', 0,
   array['Unlimited everything', 'Dedicated support', 'SSO / SAML', 'SLA'])
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- USER ACCOUNTS  (profiles, extending auth.users)
-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase manages authentication in auth.users (GoTrue).
-- We never write directly to auth.users from application code.
-- This profiles table is the public-facing extension of auth.users.
--
-- Auth flow:
--   1. User signs in via Google (or any configured OAuth provider)
--   2. GoTrue creates / updates the row in auth.users
--   3. on_auth_user_created trigger fires → inserts into profiles
--   4. Application code reads/writes profiles; never touches auth.users directly
--
-- To add a provider: enable it in supabase/config.toml, set the env vars
-- in .env.local, and add the button to src/App.tsx (see VITE_AUTH_PROVIDERS).

create table profiles (
  -- Identity (linked to Supabase auth)
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,                   -- synced from auth.users; kept for quick lookup
  display_name  text,                            -- full name from OAuth provider (editable)
  username      text unique,                     -- @handle; null until user sets it during onboarding
  avatar_url    text,                            -- from OAuth provider (editable)
  bio           text,                            -- user-written; nullable

  -- Preferences
  locale        text not null default 'en',      -- IETF BCP 47 language tag
  timezone      text,                            -- IANA tz database name (e.g. 'America/New_York')

  -- Subscription
  billing_plan  text not null default 'free' references billing_plans(id),

  -- Lifecycle
  onboarded_at  timestamptz,                     -- null = onboarding not yet complete
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger touch_profiles_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

alter table profiles enable row level security;
create policy "profiles: users read own"    on profiles for select using (auth.uid() = id);
create policy "profiles: users update own"  on profiles for update using (auth.uid() = id);

-- ── Trigger: auto-create profile on OAuth signup ──────────────────────────────
-- Fires after GoTrue inserts a new row in auth.users (first login = signup in SPD).
-- Populates display_name and avatar_url from the OAuth provider's user_metadata.
-- Note: raw_user_meta_data fields vary by provider:
--   Google:   full_name, avatar_url
--   GitHub:   full_name, avatar_url
--   Twitter:  full_name, avatar_url (approximated from name + profile_image_url)
--   LinkedIn: full_name, avatar_url
-- FACADE — extend this function to initialize your own per-user domain data.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',          -- fallback: GitHub uses 'name'
      split_part(new.email, '@', 1)             -- last resort: username part of email
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'        -- Google uses 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Trigger: keep profiles.email in sync when auth.users.email changes ────────

create or replace function sync_profile_email()
returns trigger language plpgsql security definer as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function sync_profile_email();

-- ═══════════════════════════════════════════════════════════════════════════
-- FACADE TABLES  — delete these when building your real domain model
-- ═══════════════════════════════════════════════════════════════════════════
-- These exist only to give App.tsx's Events and Announcements tabs
-- something real to query. Human or AI: delete with confidence.

-- Events (backs the Events + Calendar tabs in App.tsx)
create table events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger touch_events_updated_at
  before update on events for each row execute function touch_updated_at();
alter table events enable row level security;
create policy "events: public read" on events for select using (is_public = true);

-- Announcements (simple CMS-style feed; remove if not needed)
create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger touch_announcements_updated_at
  before update on announcements for each row execute function touch_updated_at();
alter table announcements enable row level security;
create policy "announcements: public read published"
  on announcements for select using (published = true);
