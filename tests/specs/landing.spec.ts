/**
 * landing.spec.ts — implements tests/features/landing.feature
 * Screenshot assertion is the visual gate for dev → staging promotion.
 */
import { test, expect } from '@playwright/test'

test('@smoke a visitor sees the event landing page', async ({ page }) => {
  // Given a visitor opens the app
  await page.goto('/')

  // Then they see the event title
  await expect(page.getByTestId('app-title')).toBeVisible()

  // And they see the tagline
  await expect(page.getByTestId('app-tagline')).toBeVisible()

  // And the page matches the approved screenshot
  await expect(page).toHaveScreenshot('landing.png', { fullPage: true })
})
