#!/usr/bin/env bun
/**
 * seed-actors.ts — provisions the three starter screenplay actors as real,
 * working Supabase Auth accounts: Albert, Beth, and Carol (see
 * screenplay/personae/). Idempotent — safe to run repeatedly.
 *
 * Why this exists: email + password is the zero-external-setup way to see
 * three distinct, simultaneous logged-in users working (no OAuth app,
 * client secret, or redirect URL to configure first). Real Google/GitHub
 * OAuth stays available in App.tsx for when you're ready to wire it up —
 * this script exists so the starter screenplay works the moment
 * `supabase start` is running.
 *
 * Usage:
 *   bun run seed:actors
 *
 * Requires (local dev — never point this at a prod project):
 *   SUPABASE_URL              — defaults to http://localhost:54321
 *   SUPABASE_SERVICE_ROLE_KEY — from `supabase status` (local dev key)
 *
 * Credentials for each actor come from .env.local if set
 * (ALBERT_TEST_EMAIL / ALBERT_TEST_PASSWORD, etc. — same vars
 * screenplay/tests/fixtures/auth.ts reads), otherwise a sensible local default.
 * Prints the actual credentials used so you can log in manually too.
 */
import { createClient } from '@supabase/supabase-js'

interface Actor {
  envPrefix:   string
  displayName: string
  defaultEmail: string
  avatarPath:  string
}

const ACTORS: Actor[] = [
  { envPrefix: 'ALBERT', displayName: 'Albert', defaultEmail: 'albert@example.com', avatarPath: '/avatars/albert.svg' },
  { envPrefix: 'BETH',   displayName: 'Beth',   defaultEmail: 'beth@example.com',   avatarPath: '/avatars/beth.svg' },
  { envPrefix: 'CAROL',  displayName: 'Carol',  defaultEmail: 'carol@example.com',  avatarPath: '/avatars/carol.svg' },
]

const DEFAULT_PASSWORD = 'screenplay-dev-only'

async function main() {
  const url        = process.env.SUPABASE_URL ?? 'http://localhost:54321'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required. Run `supabase status` for the local dev value.')
    console.error('Never run this against a production project — it creates real, password-known accounts.')
    process.exit(1)
  }
  if (/\.supabase\.co$/.test(new URL(url).hostname) && !url.includes('local')) {
    console.error(`Refusing to seed actors against a non-local URL: ${url}`)
    console.error('This script is for local development only.')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log(`Seeding starter actors against ${url}\n`)

  for (const actor of ACTORS) {
    const email    = process.env[`${actor.envPrefix}_TEST_EMAIL`]    ?? actor.defaultEmail
    const password = process.env[`${actor.envPrefix}_TEST_PASSWORD`] ?? DEFAULT_PASSWORD

    // Idempotent: look up by email first (admin.listUsers + filter, since
    // there's no direct getUserByEmail in the JS client), create if absent,
    // update metadata/password if present.
    const { data: existing } = await admin.auth.admin.listUsers()
    const found = existing?.users.find(u => u.email === email)

    const metadata = {
      full_name:  actor.displayName,
      avatar_url: actor.avatarPath,
      seeded_by:  'seed-actors.ts',
    }

    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        password,
        user_metadata: metadata,
        email_confirm: true,
      })
      console.log(`  updated  ${actor.displayName.padEnd(8)} ${email}`)
    } else {
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      })
      if (error) {
        console.error(`  FAILED   ${actor.displayName.padEnd(8)} ${email} — ${error.message}`)
        continue
      }
      console.log(`  created  ${actor.displayName.padEnd(8)} ${email}`)
    }
  }

  console.log('\nSign in with any of these at the login page (Continue with email):\n')
  for (const actor of ACTORS) {
    const email    = process.env[`${actor.envPrefix}_TEST_EMAIL`]    ?? actor.defaultEmail
    const password = process.env[`${actor.envPrefix}_TEST_PASSWORD`] ?? DEFAULT_PASSWORD
    console.log(`  ${actor.displayName.padEnd(8)} ${email}  /  ${password}`)
  }
  console.log()
}

main().catch(err => {
  console.error('seed-actors failed:', err)
  process.exit(1)
})
