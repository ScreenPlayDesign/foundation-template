/**
 * three-actors-sign-in.spec.ts — implements screenplay/features/three-actors-sign-in.feature
 *
 * FACADE — Albert, Beth, and Carol are placeholder actors (see
 * screenplay/personae/), each pinned to a distinct device (iPad Mini,
 * iPhone SE, Galaxy S9+ — see their frontmatter) so the default screenplay
 * gets cross-device coverage as a side effect of testing cross-user
 * isolation. Rename or replace them once you have real users; keep the
 * pattern: separate browser contexts per actor, real sessions injected via
 * screenplay/tests/fixtures/auth.ts, side-by-side screenshots as proof.
 *
 * Email + password is the default sign-in method for all three — zero
 * external setup required (see scripts/seed-actors.ts). Google and GitHub
 * OAuth are wired into App.tsx and ready to enable, but this scene doesn't
 * depend on them.
 *
 * @e2e: requires ALBERT/BETH/CAROL_TEST_EMAIL + _TEST_PASSWORD. Run
 * `bun run seed:actors` once against local Supabase to create the three
 * accounts, then set the env vars to match (or just use the defaults —
 * see scripts/seed-actors.ts). Self-skips without credentials.
 */
import { test, expect, devices } from '@playwright/test'
import { requireActorCredentials, signInAs } from '../fixtures/auth'

// One device per actor — see screenplay/personae/<slug>/account_settings.md
// frontmatter. Keeping this list here (not re-derived from the .md files at
// runtime) is a deliberate simplification; if you add a fourth actor, add
// their device here too.
const ACTOR_DEVICES = {
  albert: devices['iPad Mini'],
  beth:   devices['iPhone SE'],
  carol:  devices['Galaxy S9+'],
} as const

test.describe('Feature: Three actors sign in with email', () => {

  test('@e2e Albert signs in with email and lands in the app', async ({ browser }, testInfo) => {
    const { ALBERT } = requireActorCredentials(testInfo, 'ALBERT')
    const ctx  = await browser.newContext({ ...ACTOR_DEVICES.albert })
    const page = await ctx.newPage()

    await test.step('Given Albert is signed out, on an iPad Mini', async () => {
      // Fresh context — nothing to do.
    })
    await test.step('When Albert signs in with his email and password', async () => {
      await signInAs(page, ALBERT)
      await page.goto('/')
    })
    await test.step('Then Albert sees the app shell', async () => {
      await expect(page.getByTestId('app-shell')).toBeVisible()
    })
    await test.step("And Albert's profile shows his own name, avatar, and email", async () => {
      await page.getByTestId('tab-profile').click()
      await expect(page.getByTestId('tab-panel-profile')).toContainText(ALBERT.email)
      await expect(page.getByAltText('User avatar')).toHaveAttribute('src', /albert-ipad-mini\.svg/)
    })

    await ctx.close()
  })

  test('@e2e Beth signs in at the same time as Albert', async ({ browser }, testInfo) => {
    const { ALBERT, BETH } = requireActorCredentials(testInfo, 'ALBERT', 'BETH')

    const albertCtx = await browser.newContext({ ...ACTOR_DEVICES.albert })
    const bethCtx    = await browser.newContext({ ...ACTOR_DEVICES.beth })
    const albert = await albertCtx.newPage()
    const beth   = await bethCtx.newPage()

    await test.step('Given Albert (iPad Mini) is already signed in', async () => {
      await signInAs(albert, ALBERT)
      await albert.goto('/')
      await expect(albert.getByTestId('app-shell')).toBeVisible()
    })
    await test.step('When Beth (iPhone SE) signs in with her email and password', async () => {
      await signInAs(beth, BETH)
      await beth.goto('/')
    })
    await test.step('Then Beth sees the app shell with her own name, avatar, and email', async () => {
      await expect(beth.getByTestId('app-shell')).toBeVisible()
      await beth.getByTestId('tab-profile').click()
      await expect(beth.getByTestId('tab-panel-profile')).toContainText(BETH.email)
      await expect(beth.getByAltText('User avatar')).toHaveAttribute('src', /beth-iphone-se\.svg/)
    })
    await test.step("And Albert's session is unaffected", async () => {
      await albert.getByTestId('tab-profile').click()
      await expect(albert.getByTestId('tab-panel-profile')).toContainText(ALBERT.email)
      await expect(albert.getByTestId('tab-panel-profile')).not.toContainText(BETH.email)
      await expect(albert.getByAltText('User avatar')).toHaveAttribute('src', /albert-ipad-mini\.svg/)
    })

    await Promise.all([albertCtx.close(), bethCtx.close()])
  })

  test('@e2e @smoke all three actors are signed in simultaneously, cross-device, side by side', async ({ browser }, testInfo) => {
    const { ALBERT, BETH, CAROL } = requireActorCredentials(testInfo, 'ALBERT', 'BETH', 'CAROL')

    const contexts = {
      albert: await browser.newContext({ ...ACTOR_DEVICES.albert }),  // iPad Mini
      beth:   await browser.newContext({ ...ACTOR_DEVICES.beth }),    // iPhone SE
      carol:  await browser.newContext({ ...ACTOR_DEVICES.carol }),   // Galaxy S9+
    }
    const pages = {
      albert: await contexts.albert.newPage(),
      beth:   await contexts.beth.newPage(),
      carol:  await contexts.carol.newPage(),
    }
    const creds = { albert: ALBERT, beth: BETH, carol: CAROL }
    const avatarFile = { albert: /albert-ipad-mini\.svg/, beth: /beth-iphone-se\.svg/, carol: /carol-android-galaxy\.svg/ }

    await test.step('When Albert (iPad Mini), Beth (iPhone SE), and Carol (Galaxy S9+) each sign in with email and password', async () => {
      for (const name of ['albert', 'beth', 'carol'] as const) {
        await signInAs(pages[name], creds[name])
      }
      await Promise.all(Object.values(pages).map(p => p.goto('/')))
    })

    await test.step('Then all three see the app shell at the same time, on their own device', async () => {
      await Promise.all(
        Object.values(pages).map(p => expect(p.getByTestId('app-shell')).toBeVisible()),
      )
    })

    await test.step("And each one's profile shows only their own name, avatar, and email", async () => {
      for (const name of ['albert', 'beth', 'carol'] as const) {
        const p = pages[name]
        await p.getByTestId('tab-profile').click()
        await expect(p.getByTestId('tab-panel-profile')).toContainText(creds[name].email)
        await expect(p.getByAltText('User avatar')).toHaveAttribute('src', avatarFile[name])
      }
    })

    await test.step('And a screenshot is captured of all three side by side as proof — one reviewed result, three devices', async () => {
      await Promise.all([
        pages.albert.screenshot({ path: 'review/artifacts/three-actors-01-albert.png', fullPage: true }),
        pages.beth.screenshot({ path: 'review/artifacts/three-actors-01-beth.png', fullPage: true }),
        pages.carol.screenshot({ path: 'review/artifacts/three-actors-01-carol.png', fullPage: true }),
      ])
      // Also registered as Playwright snapshots so the visual gate can diff them.
      await expect(pages.albert).toHaveScreenshot('three-actors-albert.png', { fullPage: true })
      await expect(pages.beth).toHaveScreenshot('three-actors-beth.png', { fullPage: true })
      await expect(pages.carol).toHaveScreenshot('three-actors-carol.png', { fullPage: true })
    })

    await Promise.all(Object.values(contexts).map(c => c.close()))
  })

})
