-- supabase/seed.sql — SPD Event App · Development Seed Data
-- ─────────────────────────────────────────────────────────────────────────────
-- FACADE — this data exists to make the facade UI in App.tsx feel inhabited.
-- Runs on `supabase db reset` and can be re-run via `make db.seed`.
-- Delete or replace this file when you build your real app.
--
-- NOTE: billing_plans are seeded inside 001_init.sql (not here) because they
-- must exist before the first user signup can succeed (FK constraint on profiles).
-- Only truly optional / environment-specific data belongs in seed.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Sample events (drive the Events + Calendar tabs) ──────────────────────────
-- Dates are relative to insertion time so the UI always looks current.
-- FACADE — delete these when building your real app.

insert into events (title, description, starts_at, ends_at, location, is_public) values
  (
    'Summer Kickoff Party',
    'Kicking off the season with the whole team. Food, drinks, and a product demo.',
    now() + interval '9 days',
    now() + interval '9 days' + interval '4 hours',
    'City Park Pavilion, Lancaster PA',
    true
  ),
  (
    'Team Offsite — Strategy',
    'Two days of roadmap planning and team building. Agenda shared separately.',
    now() + interval '16 days',
    now() + interval '18 days',
    'Wharton Esherick Estate, Malvern PA',
    false
  ),
  (
    'Client Showcase',
    'Quarterly demo for key accounts. New features and roadmap preview.',
    now() + interval '24 days',
    now() + interval '24 days' + interval '2 hours',
    'Virtual — Zoom link in calendar invite',
    true
  ),
  (
    'Annual Gala',
    'End-of-year celebration. Black tie optional. Awards ceremony at 8pm.',
    now() + interval '45 days',
    now() + interval '45 days' + interval '5 hours',
    'The Pressroom, Lancaster PA',
    true
  )
on conflict do nothing;
