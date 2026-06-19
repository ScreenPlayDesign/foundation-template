/**
 * src/types/shared-contracts.ts — canonical TypeScript types for this project
 * ─────────────────────────────────────────────────────────────────────────────
 * Source of truth for all types shared between the frontend and backend.
 * The SPD data daemon reads this file to verify that Supabase migrations and
 * RLS policies match the TypeScript interface definitions.
 *
 * Rules:
 *   · One interface per table
 *   · Field names match DB column names exactly (snake_case)
 *   · Enums use string literals where SQL uses text columns
 *   · Never import from app-specific modules — this is pure types only
 *   · Keep in sync with supabase/migrations/001_init.sql
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── billing_plans ─────────────────────────────────────────────────────────────
// FACADE — illustrative plan tiers. Replace with your actual pricing model.
// Reference data seeded inside 001_init.sql (not seed.sql — needed before first signup).

export type BillingPlanId = 'free' | 'pro' | 'enterprise'

export interface BillingPlan {
  id:                  BillingPlanId
  display_name:        string
  price_monthly_cents: number
  features:            string[]
  is_active:           boolean
}

// ── profiles ──────────────────────────────────────────────────────────────────
// One row per auth.users row. Auto-created by the handle_new_user trigger on
// every OAuth signup (Google, GitHub, etc.). Never write to auth.users directly.
//
// Field notes:
//   email        — denormalized from auth.users for fast queries; synced by trigger
//   username     — the @handle; null until set during onboarding
//   onboarded_at — null until the user completes the onboarding flow
//   billing_plan — FK to billing_plans; defaults to 'free'

export interface Profile {
  id:           string        // uuid, references auth.users(id)
  email:        string        // kept in sync by sync_profile_email trigger
  display_name: string | null // from OAuth provider; editable
  username:     string | null // @handle; set during onboarding
  avatar_url:   string | null // from OAuth provider; editable
  bio:          string | null
  locale:       string        // IETF BCP 47 (e.g. 'en', 'en-US')
  timezone:     string | null // IANA tz (e.g. 'America/New_York')
  billing_plan: BillingPlanId
  onboarded_at: string | null // ISO 8601; null = onboarding incomplete
  created_at:   string
  updated_at:   string
}

// ── events ────────────────────────────────────────────────────────────────────
// FACADE — the public event catalog backing the Events and Calendar tabs.
// Delete this and its table when building your real app.

export interface Event {
  id:          string
  title:       string
  description: string | null
  starts_at:   string
  ends_at:     string
  location:    string | null
  is_public:   boolean
  created_at:  string
  updated_at:  string
}

// ── announcements ─────────────────────────────────────────────────────────────
// Simple CMS-style broadcast. Remove if your app doesn't need it.

export interface Announcement {
  id:         string
  title:      string
  body:       string | null
  published:  boolean
  created_at: string
  updated_at: string
}
