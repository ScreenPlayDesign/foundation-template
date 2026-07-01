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
 * Avatars are uploaded to Supabase Storage here, not shipped as static
 * files in frontend/public/ — a real user's avatar is something attached
 * to their account, not a file the app happens to be built with. Each
 * actor's screenplay/personae/<slug>/avatar.svg is the source image;
 * this script uploads it to the "avatars" Storage bucket (created if
 * missing) and sets the resulting public URL as user_metadata.avatar_url,
 * the same way a real avatar-upload feature would.
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
 * screenplay/tests/fixtures/auth.ts reads), otherwise a sensible local
 * default. Prints the actual credentials used so you can log in manually
 * too.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const AVATAR_BUCKET = 'avatars'

interface Actor {
  envPrefix:    string
  displayName:  string
  defaultEmail: string
  slug:         string   // matches screenplay/personae/<slug>/
}

const ACTORS: Actor[] = [
  { envPrefix: 'ALBERT', displayName: 'Albert', defaultEmail: 'albert@example.com', slug: 'albert-ipad-mini' },
  { envPrefix: 'BETH',   displayName: 'Beth',   defaultEmail: 'beth@example.com',   slug: 'beth-iphone-se' },
  { envPrefix: 'CAROL',  displayName: 'Carol',  defaultEmail: 'carol@example.com',  slug: 'carol-android-galaxy' },
]

const DEFAULT_PASSWORD = 'screenplay-dev-only'

/** Uploads screenplay/personae/<slug>/avatar.svg to Storage; returns its public URL, or null if there's no source file. */
async function uploadAvatar(
  admin: ReturnType<typeof createClient>,
  slug: string,
): Promise<string | null> {
  const srcPath = join(process.cwd(), 'screenplay', 'personae', slug, 'avatar.svg')
  if (!existsSync(srcPath)) {
    console.warn(`  (no screenplay/personae/${slug}/avatar.svg found — skipping avatar upload)`)
    return null
  }

  const file = readFileSync(srcPath)
  const objectKey = `${slug}.svg`

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(objectKey, file, { contentType: 'image/svg+xml', upsert: true })

  if (uploadError) {
    console.error(`  FAILED to upload avatar for ${slug}: ${uploadError.message}`)
    return null
  }

  const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(objectKey)
  return data.publicUrl
}

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

  // Ensure the avatars bucket exists — idempotent, ignores "already exists".
  const { error: bucketError } = await admin.storage.createBucket(AVATAR_BUCKET, { public: true })
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    console.error(`Could not create "${AVATAR_BUCKET}" Storage bucket: ${bucketError.message}`)
    process.exit(1)
  }

  for (const actor of ACTORS) {
    const email    = process.env[`${actor.envPrefix}_TEST_EMAIL`]    ?? actor.defaultEmail
    const password = process.env[`${actor.envPrefix}_TEST_PASSWORD`] ?? DEFAULT_PASSWORD

    const avatarUrl = await uploadAvatar(admin, actor.slug)

    // Idempotent: look up by email first (admin.listUsers + filter, since
    // there's no direct getUserByEmail in the JS client), create if absent,
    // update metadata/password if present.
    const { data: existing } = await admin.auth.admin.listUsers()
    const found = existing?.users.find(u => u.email === email)

    const metadata = {
      full_name:  actor.displayName,
      avatar_url: avatarUrl,
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
