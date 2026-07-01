import { defineConfig } from '@playwright/test'

// Three jobs, two folders: screenplay/ holds both what gets written (the
// scenes, cast, and setting) and what gets generated/implemented from it
// (screenplay/tests/, nested inside since it's still committed source).
// review/ stays a sibling at repo root — it's generated build output (the
// HTML report + raw artifacts + the JSON results scripts/post-spd-results.ts
// reads), not authored content, so it doesn't live inside screenplay/.

export default defineConfig({
  testDir: './screenplay/tests',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['html', { outputFolder: 'review', open: 'never' }],
    ['json', { outputFile: 'review/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    screenshot: 'on',
  },
  expect: {
    // Visual assertions gate dev → staging promotion
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: 'bun run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  outputDir: 'review/artifacts',
})
