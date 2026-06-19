import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
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
})
