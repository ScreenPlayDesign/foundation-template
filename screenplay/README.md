# The Screenplay

This is the spec for the app — written for the producer, not just the
developer. See any SPD project's `screenplay/` for the full convention;
this template starts you off with the minimum viable cast and world. Full
background on why this shape exists, what it's called, and its real
tradeoffs: `~/dev/spd/BUILDING_THE_SCREENPLAY_PATTERN.md`.

```
screenplay/
├── personae/
│   ├── albert-ipad-mini/
│   │   ├── account_settings.md
│   │   └── avatar.svg
│   ├── beth-iphone-se/
│   │   ├── account_settings.md
│   │   └── avatar.svg
│   └── carol-android-galaxy/
│       ├── account_settings.md
│       └── avatar.svg
├── setting/              — the world your app happens in (empty — fill in)
├── features/             — the scenes: Gherkin .feature files
├── fixtures/              — props: seed data the scenes draw on
└── tests/             — the technical realization: Playwright specs
    ├── specs/              implemented from the scenes above
    └── fixtures/            (auth.ts — session injection for actor sign-in)
```

`review/` (the HTML report + raw artifacts) is a sibling at the repo root,
not nested here — it's generated build output, not authored content.

`personae/` here follows the strict, folder-per-actor convention: once a
project adopts it, `personae/` may contain only subfolders, and every
subfolder must have exactly `account_settings.md` + `avatar.svg` — no
loose files. `spd screenplay check` enforces this once it detects the
convention (auto-detected: if `personae/` has any loose `.md` file, the
older, looser convention applies instead — see fastnacht-lancaster's
`personae/` for that shape, which mixes real named collaborators with
narrative attendee personas that don't need a device or avatar).

The `avatar.svg` in each folder is the source image, not a served asset —
it never lives in `frontend/public/`. A real user's avatar is something
attached to their account, not a file the app ships with, so
`scripts/seed-actors.ts` uploads each actor's `avatar.svg` to Supabase
Storage (the `avatars` bucket, created automatically) when it creates
their account, and sets the resulting Storage URL as
`user_metadata.avatar_url` — the same path a real avatar-upload feature
would take.

## FACADE — start here, then replace it

`personae/albert-ipad-mini/`, `beth-iphone-se/`, and `carol-android-galaxy/`
are three placeholder actors, deliberately minimal: a name, a device, an
avatar, a way to log in. No backstory, no demographics — they're a
device/browser coverage mechanism, not a UX exercise. Albert is an iPad
Mini, Beth is an iPhone SE, Carol is a Galaxy S9+ — three different
viewports, so cross-device coverage comes free with the same scene that
proves cross-user isolation. `screenplay/features/
three-actors-sign-in.feature` is the scene that proves it, and
`screenplay/tests/specs/three-actors-sign-in.spec.ts` is the Playwright
implementation — three real browser contexts, three real devices, one
reviewed result.

Run `bun run seed:actors` once against local Supabase to create the three
accounts (email + password — zero external setup), then `bun run dev` and
sign in as any of them at the login page's "Continue with email." Google
and GitHub OAuth are wired into `App.tsx` and on by default per the
platform convention, but nothing here depends on having them configured.

Keep the *pattern* — multi-actor scenes, named personas instead of "User
A/B/C," side-by-side screenshots as proof multiple people don't interfere
with each other — and replace the *content*. Albert, Beth, and Carol
almost certainly aren't your users. Delete them once you've written the
real cast for your app, the same way `App.tsx`'s facade UI gets torn out
once you have a real one. If you keep persona-driven scenes for your real
users, mark each persona's `confidence` as `assumption` until you've
actually checked it against something real — see
`BUILDING_THE_SCREENPLAY_PATTERN.md` for why that distinction matters.

## Why three actors, not one

A single-user smoke test proves the app loads. It doesn't prove that
Albert's session doesn't leak into Beth's browser, that Carol's data
doesn't show up in Albert's view, or that the app behaves correctly when
three real people are using it at the same time — which is the normal
case for almost any app, not an edge case. Starting with three actors
from day one means every scene you add afterward inherits that habit
instead of bolting it on later. Pinning each actor to a different device
(iPad Mini, iPhone SE, Galaxy S9+) means you also get cross-device
coverage for free, without a separate device-matrix test suite to
maintain. That said: reserve multi-actor scenes for
things that actually need them (concurrency, cross-user isolation).
Single-actor scenes are correct and cheaper for most features.

## Auth in scenes — read this before writing "as a Y, I sign in with Google"

Google OAuth cannot be driven by Playwright (there's no reliable, ToS-safe
way to automate Google's actual consent screen). `screenplay/tests/
fixtures/auth.ts` seeds a real Supabase session for a real (test-only)
user account and injects it into `localStorage`, which is what the app's
`onAuthStateChange` picks up — functionally equivalent to having just
completed the OAuth flow, without touching Google's UI. This requires
three seeded test accounts (see `screenplay/tests/fixtures/auth.ts`
for the env vars) — scenarios that need them self-skip if the credentials
aren't configured, so they never flake a CI run that hasn't set them up
yet.
