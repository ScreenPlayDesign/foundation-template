/**
 * tests/fixtures/auth.ts — session injection for actor-authenticated scenes
 *
 * Email + password (via Supabase's password grant) is the default sign-in
 * method for the three starter actors — see scripts/seed-actors.ts, which
 * provisions real accounts for exactly this. This same mechanism doubles
 * as the OAuth substitute for tests once you enable Google/GitHub sign-in
 * for real: neither provider's consent screen can be automated by
 * Playwright, but a real Supabase session injected into localStorage in
 * the shape @supabase/supabase-js expects is functionally identical to
 * one produced by a completed OAuth redirect — the app's
 * onAuthStateChange can't tell the difference.
 *
 * Requires three seeded accounts (bun run seed:actors) and their
 * credentials set as env vars, one set per actor:
 *
 *   ALBERT_TEST_EMAIL / ALBERT_TEST_PASSWORD
 *   BETH_TEST_EMAIL   / BETH_TEST_PASSWORD
 *   CAROL_TEST_EMAIL  / CAROL_TEST_PASSWORD
 *
 * Scenarios using signInAs() self-skip (via requireActorCredentials) if the
 * relevant pair isn't set, so this never flakes a CI run that hasn't
 * configured test users yet.
 */
import type { Page, TestInfo } from '@playwright/test'
import { test } from '@playwright/test'

export interface ActorCredentials {
  email:    string
  password: string
}

/** Reads ALBERT/BETH/CAROL_TEST_EMAIL + _PASSWORD for a given actor name. */
export function actorCredentials(envPrefix: string): ActorCredentials | null {
  const email    = process.env[`${envPrefix}_TEST_EMAIL`]
  const password = process.env[`${envPrefix}_TEST_PASSWORD`]
  if (!email || !password) return null
  return { email, password }
}

/**
 * Call at the top of a test/scenario. Skips the test (not a failure) if
 * credentials for any of the given actors aren't configured — matches the
 * self-skip convention used across SPD projects for @e2e scenes.
 */
export function requireActorCredentials(testInfo: TestInfo, ...envPrefixes: string[]): Record<string, ActorCredentials> {
  const found: Record<string, ActorCredentials> = {}
  const missing: string[] = []
  for (const prefix of envPrefixes) {
    const creds = actorCredentials(prefix)
    if (!creds) missing.push(prefix)
    else found[prefix] = creds
  }
  if (missing.length > 0) {
    test.skip(true, `Missing test credentials for: ${missing.join(', ')} (set <NAME>_TEST_EMAIL / _PASSWORD)`)
  }
  return found
}

/**
 * Signs a page in as the given actor by exchanging credentials for a real
 * Supabase session (password grant) and injecting it into localStorage
 * before the app loads. Must be called before page.goto().
 */
export async function signInAs(page: Page, creds: ActorCredentials) {
  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set to inject a session.')
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
    body:    JSON.stringify({ email: creds.email, password: creds.password }),
  })
  if (!res.ok) {
    throw new Error(`signInAs(${creds.email}) failed: ${res.status} ${await res.text()}`)
  }
  const session = await res.json()

  // Key format: sb-<project-ref>-auth-token. Extract the ref from the URL
  // (https://<ref>.supabase.co) rather than hardcoding it.
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [storageKey, JSON.stringify(session)],
  )
}
