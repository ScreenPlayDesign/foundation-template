/**
 * landing.spec.ts — implements tests/features/landing.feature
 * Screenshot assertion is the visual gate for dev → staging promotion.
 *
 * FACADE — tests the login page shown to unauthenticated visitors.
 * Authenticated flows (app shell, tabs) require real OAuth and are therefore
 * tested manually or in separate actor-authenticated specs.
 */
import { test, expect } from '@playwright/test'

test('@smoke a visitor sees the sign-in page', async ({ page }) => {
  // Given a visitor opens the app
  await page.goto('/')

  // Then the login page is shown
  await expect(page.getByTestId('login-page')).toBeVisible()

  // And they see the app title and tagline
  await expect(page.getByTestId('app-title')).toContainText('SPD Event App')
  await expect(page.getByTestId('app-tagline')).toBeVisible()

  // And they see the Google sign-in button
  await expect(page.getByTestId('google-signin')).toBeVisible()

  // And the page matches the approved screenshot
  await expect(page).toHaveScreenshot('landing.png', { fullPage: true })
})
