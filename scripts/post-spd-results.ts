#!/usr/bin/env bun
/**
 * post-spd-results.ts
 *
 * Reads Playwright's JSON output (test-results/results.json) and posts
 * per-scenario results to the ScreenPlayDesign dashboard via the cli-api
 * /test-report endpoint.
 *
 * Called by ci.yml after `bun run test`. Non-fatal — errors are logged
 * but the CI job continues.
 *
 * Required env vars (set as GitHub repo secrets / vars):
 *   SPD_API_TOKEN     — personal access token from screenplaydesign.com
 *   SPD_API_URL       — https://screenplaydesign.com/api/cli
 *   SPD_PROJECT_SLUG  — project slug as registered in the SPD dashboard
 *   BRANCH            — current git branch (injected by ci.yml)
 *   GITHUB_RUN_URL    — link to this Actions run (injected by ci.yml)
 *   PLAYWRIGHT_EXIT   — 'success' | 'failure' (injected by ci.yml)
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const RESULTS_FILE = join(process.cwd(), 'test-results', 'results.json')

interface PlaywrightSpec {
  title:    string
  ok:       boolean
  duration: number
  results:  Array<{
    status:      'passed' | 'failed' | 'skipped' | 'timedOut'
    duration:    number
    error?:      { message: string }
    attachments: Array<{ name: string; path?: string; body?: string; contentType: string }>
  }>
}

interface PlaywrightSuite {
  title:  string
  file?:  string
  suites?: PlaywrightSuite[]
  specs?:  PlaywrightSpec[]
}

interface PlaywrightReport {
  stats: {
    expected:   number
    unexpected: number
    skipped:    number
  }
  suites: PlaywrightSuite[]
}

function flattenSpecs(suite: PlaywrightSuite, file = suite.file ?? suite.title): Array<{
  file: string; title: string; spec: PlaywrightSpec
}> {
  const results: Array<{ file: string; title: string; spec: PlaywrightSpec }> = []
  for (const spec of suite.specs ?? []) {
    results.push({ file, title: spec.title, spec })
  }
  for (const child of suite.suites ?? []) {
    results.push(...flattenSpecs(child, child.file ?? file))
  }
  return results
}

async function main() {
  const token   = process.env.SPD_API_TOKEN
  const apiUrl  = process.env.SPD_API_URL
  const slug    = process.env.SPD_PROJECT_SLUG
  const branch  = process.env.BRANCH  ?? 'unknown'
  const runUrl  = process.env.GITHUB_RUN_URL ?? null
  const exitStr = process.env.PLAYWRIGHT_EXIT ?? 'success'

  if (!token || !apiUrl || !slug) {
    console.log('SPD_API_TOKEN, SPD_API_URL, and SPD_PROJECT_SLUG must be set. Skipping.')
    process.exit(0)
  }

  // Parse Playwright JSON output
  let report: PlaywrightReport | null = null
  if (existsSync(RESULTS_FILE)) {
    try {
      report = JSON.parse(readFileSync(RESULTS_FILE, 'utf8')) as PlaywrightReport
    } catch (e) {
      console.warn('Could not parse results.json:', e)
    }
  }

  const passed  = report?.stats.expected   ?? 0
  const failed  = report?.stats.unexpected ?? 0
  const skipped = report?.stats.skipped    ?? 0
  const total   = passed + failed + skipped

  const overallStatus: 'passed' | 'failed' = exitStr === 'success' ? 'passed' : 'failed'

  // Build scenario list
  const scenarios: Array<{
    feature_file:  string
    scenario_name: string
    scenario_tags: string[]
    status:        'passed' | 'failed' | 'skipped' | 'pending'
    duration_ms:   number | null
    error_message: string | null
    screenshot_url: string | null
    sort_order:    number
  }> = []

  if (report) {
    const allSpecs = report.suites.flatMap(s => flattenSpecs(s))
    allSpecs.forEach(({ file, title, spec }, idx) => {
      // Take the last result (after retries)
      const result = spec.results[spec.results.length - 1]
      const status: 'passed' | 'failed' | 'skipped' =
        result?.status === 'passed'  ? 'passed'
        : result?.status === 'skipped' ? 'skipped'
        : 'failed'

      // Extract @tags from the title (e.g. "@smoke a visitor sees the sign-in page")
      const tagMatches = title.match(/@[\w-]+/g) ?? []
      const cleanTitle = title.replace(/@[\w-]+\s*/g, '').trim()

      // Screenshot attachment: Playwright names them after the test
      const screenshotAttachment = result?.attachments?.find(a =>
        a.contentType?.startsWith('image/') || a.name === 'screenshot'
      )
      const screenshotUrl = screenshotAttachment?.path
        ? null  // local path — can't link from dashboard; must be uploaded to storage first
        : null

      scenarios.push({
        feature_file:  file.replace(/^.*tests\//, 'tests/').replace(/\.spec\.[jt]s$/, '.feature'),
        scenario_name: cleanTitle || title,
        scenario_tags: tagMatches,
        status,
        duration_ms:   result?.duration ?? spec.duration ?? null,
        error_message: result?.error?.message?.split('\n')[0] ?? null,
        screenshot_url: screenshotUrl,
        sort_order:    idx,
      })
    })
  }

  const payload = {
    project_slug:  slug,
    branch,
    status:        overallStatus,
    total_tests:   total,
    passed_tests:  passed,
    failed_tests:  failed,
    triggered_by:  'push',
    report_url:    runUrl,
    scenarios,
  }

  console.log(`→ Posting test report to SPD: ${slug}/${branch} — ${overallStatus} (${passed}/${total})`)

  const res = await fetch(`${apiUrl}/test-report`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`✗ SPD report failed (${res.status}):`, text)
    process.exit(0)  // non-fatal
  }

  const json = await res.json() as { test_run_id?: string; scenarios_created?: number }
  console.log(`✓ SPD report posted — run: ${json.test_run_id}, scenarios: ${json.scenarios_created}`)
}

main().catch(err => {
  console.error('post-spd-results error (non-fatal):', err)
  process.exit(0)
})
