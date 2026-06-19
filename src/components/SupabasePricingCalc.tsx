/**
 * SupabasePricingCalc.tsx — Supabase cost estimator for SPD projects
 * ─────────────────────────────────────────────────────────────────────────────
 * KEEP THIS — this is not facade scaffolding. Every SPD project runs on
 * Supabase and every Producer making go/no-go decisions needs accurate numbers.
 *
 * Reflects Supabase billing as of mid-2025. If anything changes, verify at
 * https://supabase.com/pricing and update the PLANS constant below.
 *
 * Key facts encoded here:
 *   · MAU = any authenticated user who signs in OR has their JWT auto-refreshed
 *     at least once in a calendar month. "Active" means the app was open.
 *   · Token auto-refresh fires ~every 60 min while a tab is open. A user who
 *     leaves a tab open all month = 1 MAU, not one per refresh.
 *   · Inactive users (never opened the app that month) = 0 MAUs.
 *   · Anonymous sign-ins count as MAUs when created via signInAnonymously().
 *   · Free plan hard-caps at 50k MAUs. Pro overages bill at $0.00325/MAU.
 *   · SMS/Phone OTP is NOT included — billed via Twilio separately.
 *   · All OAuth providers (Google, GitHub, etc.) are included in base price.
 *   · CRITICAL for SPD: Free tier allows 2 projects max per org.
 *     staging + prod = 2 projects = your entire free quota.
 *     First paying client should trigger a Pro upgrade ($25/mo).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'

// ── Pricing data — update if Supabase changes rates ───────────────────────────
// Source: https://supabase.com/pricing (verified mid-2025)

const PLANS = {
  free: {
    label:        'Free',
    baseCents:    0,
    includedMAU:  50_000,
    extraPerMAU:  null,        // no overages — hard cap, must upgrade
    maxProjects:  2,
    dbGB:         0.5,
    storageGB:    5,
    bandwidthGB:  5,
    edgeFnFree:   500_000,     // invocations/month
  },
  pro: {
    label:        'Pro',
    baseCents:    2500,        // $25.00/month
    includedMAU:  100_000,
    extraPerMAU:  0.00325,     // $0.00325 per MAU above 100k
    maxProjects:  Infinity,
    dbGB:         8,
    storageGB:    100,
    bandwidthGB:  250,
    edgeFnFree:   2_000_000,
  },
  team: {
    label:        'Team',
    baseCents:    59900,       // $599/month per org
    includedMAU:  Infinity,
    extraPerMAU:  0,
    maxProjects:  Infinity,
    dbGB:         Infinity,    // effectively unlimited (compute-based billing)
    storageGB:    Infinity,
    bandwidthGB:  Infinity,
    edgeFnFree:   Infinity,
  },
} as const

type PlanKey = keyof typeof PLANS

// MAU cost milestones shown in the reference table
const MILESTONES = [10_000, 25_000, 50_000, 75_000, 100_000, 250_000, 500_000, 1_000_000]

function mauCost(mau: number, plan: PlanKey): number | null {
  const p = PLANS[plan]
  if (p.extraPerMAU === null) return mau > p.includedMAU ? null : p.baseCents / 100
  const overage = Math.max(0, mau - p.includedMAU)
  return p.baseCents / 100 + overage * p.extraPerMAU
}

function fmtDollars(n: number | null): string {
  if (n === null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/mo`
}

function fmtNum(n: number): string {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(0)}k`
    : String(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SupabasePricingCalc() {
  const [totalUsers, setTotalUsers] = useState(10_000)
  const [activeRatePct, setActiveRate] = useState(30)
  const [plan, setPlan] = useState<PlanKey>('free')

  const estimatedMAU   = Math.round(totalUsers * activeRatePct / 100)
  const currentPlan    = PLANS[plan]
  const isOverLimit    = estimatedMAU > currentPlan.includedMAU
  const cost           = mauCost(estimatedMAU, plan)
  const overageMAU     = Math.max(0, estimatedMAU - currentPlan.includedMAU)
  const overageCost    = currentPlan.extraPerMAU != null ? overageMAU * currentPlan.extraPerMAU : null

  return (
    <div className="space-y-6 rounded-xl border border-slate-700 bg-slate-800/40 p-6">
      <div>
        <h3 className="font-semibold text-slate-100">Supabase Cost Estimator</h3>
        <p className="text-xs text-slate-500 mt-0.5">Rates as of mid-2025 · verify at supabase.com/pricing</p>
      </div>

      {/* ── How MAUs are counted ── */}
      <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4 space-y-2 text-xs text-sky-300">
        <p className="font-semibold text-sky-200">How Supabase counts Monthly Active Users (MAUs)</p>
        <ul className="space-y-1 text-sky-300/80 list-none">
          <li>· A user counts as 1 MAU the first time they sign in <em>or</em> auto-refresh their JWT in a calendar month.</li>
          <li>· JWT auto-refresh fires ~every 60 min while your app is open. Any open tab = that user is an MAU for the month.</li>
          <li>· Users who never open the app that month = 0 MAUs (they don't count even if registered).</li>
          <li>· Anonymous sessions created via <code>signInAnonymously()</code> also count.</li>
          <li>· All OAuth providers (Google, GitHub, etc.) are included — no per-provider charge.</li>
          <li>· SMS/Phone OTP is billed separately via Twilio and is NOT estimated here.</li>
        </ul>
      </div>

      {/* ── SPD-specific warning ── */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-300 space-y-1">
        <p className="font-semibold text-amber-200">Critical for SPD projects</p>
        <p>Free tier = <strong>2 projects max per org</strong>. Each SPD app needs <strong>staging + prod = 2 projects</strong>.
          That exhausts your free quota for a single client app.
          A second client forces either a new org or a Pro upgrade.</p>
        <p className="text-amber-300/70 mt-1">
          Recommended: upgrade to Pro ($25/mo) before your first paying client.
          Pro gives unlimited projects and 100k MAUs — plenty of headroom.
        </p>
      </div>

      {/* ── Inputs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="space-y-2">
          <span className="text-sm text-slate-400">Total registered users</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={100} max={2_000_000} step={100}
              value={totalUsers}
              onChange={e => setTotalUsers(Number(e.target.value))}
              className="flex-1 accent-sky-500"
            />
            <span className="text-sm font-mono text-slate-200 w-16 text-right">
              {fmtNum(totalUsers)}
            </span>
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-400">Monthly active rate</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1} max={100}
              value={activeRatePct}
              onChange={e => setActiveRate(Number(e.target.value))}
              className="flex-1 accent-sky-500"
            />
            <span className="text-sm font-mono text-slate-200 w-16 text-right">
              {activeRatePct}%
            </span>
          </div>
        </label>
      </div>

      <div className="text-sm text-slate-400">
        Estimated MAUs:{' '}
        <span className="text-slate-100 font-semibold font-mono">{fmtNum(estimatedMAU)}</span>
        {' '}({activeRatePct}% of {fmtNum(totalUsers)} users)
      </div>

      {/* ── Plan selector ── */}
      <div className="space-y-2">
        <span className="text-sm text-slate-400">Plan</span>
        <div className="flex gap-2">
          {(Object.keys(PLANS) as PlanKey[]).map(p => (
            <button
              key={p}
              onClick={() => setPlan(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                plan === p
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {PLANS[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cost breakdown ── */}
      <div className="rounded-lg bg-slate-900/60 border border-slate-700 divide-y divide-slate-700 text-sm">
        <Row label="Base fee" value={`$${(currentPlan.baseCents / 100).toFixed(0)}/mo`} />
        <Row
          label="Included MAUs"
          value={currentPlan.includedMAU === Infinity ? 'Unlimited' : fmtNum(currentPlan.includedMAU)}
        />
        <Row
          label="Your estimated MAUs"
          value={fmtNum(estimatedMAU)}
          accent={isOverLimit ? 'warn' : 'ok'}
        />
        {isOverLimit && plan !== 'team' && (
          <>
            <Row
              label="Overage MAUs"
              value={currentPlan.extraPerMAU === null ? `${fmtNum(overageMAU)} — upgrade required` : fmtNum(overageMAU)}
              accent={currentPlan.extraPerMAU === null ? 'error' : 'warn'}
            />
            {overageCost != null && (
              <Row label="Overage cost" value={`$${overageCost.toFixed(2)}/mo`} accent="warn" />
            )}
          </>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-slate-100">Estimated total</span>
          <span className={`font-bold font-mono text-base ${
            cost === null ? 'text-red-400' : 'text-sky-300'
          }`}>
            {cost === null ? 'UPGRADE REQUIRED' : fmtDollars(cost)}
          </span>
        </div>
      </div>

      {cost === null && (
        <p className="text-xs text-red-400">
          Free plan is hard-capped at 50k MAUs. At {fmtNum(estimatedMAU)} MAUs you must upgrade to Pro.
          Pro would cost approximately {fmtDollars(mauCost(estimatedMAU, 'pro'))}.
        </p>
      )}

      {/* ── Milestone reference table ── */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-300">Cost at key MAU milestones</p>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/40">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">MAUs</th>
                {(Object.keys(PLANS) as PlanKey[]).map(p => (
                  <th key={p} className="text-right px-3 py-2 text-slate-400 font-medium">
                    {PLANS[p].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {MILESTONES.map(mau => (
                <tr
                  key={mau}
                  className={`${
                    Math.abs(mau - estimatedMAU) < mau * 0.1
                      ? 'bg-sky-500/5'
                      : ''
                  }`}
                >
                  <td className="px-3 py-2 text-slate-300 font-mono">{fmtNum(mau)}</td>
                  {(Object.keys(PLANS) as PlanKey[]).map(p => {
                    const c = mauCost(mau, p)
                    return (
                      <td key={p} className={`px-3 py-2 text-right font-mono ${
                        c === null ? 'text-red-400' : 'text-slate-300'
                      }`}>
                        {c === null ? 'upgrade' : `$${c.toFixed(0)}`}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600">* Team plan at $599/mo is suitable above ~180k MAUs on Pro.</p>
      </div>

      {/* ── What's NOT included ── */}
      <div className="text-xs text-slate-500 space-y-1 border-t border-slate-700 pt-4">
        <p className="text-slate-400 font-medium">Not included in this estimate:</p>
        <p>· Database compute add-ons (+$10/mo for 2× CPU/RAM, etc.)</p>
        <p>· Extra database storage ($0.125/GB-month above included)</p>
        <p>· Extra bandwidth ($0.09/GB above included)</p>
        <p>· Edge Functions beyond the free tier ($2/1M invocations)</p>
        <p>· SMS/Phone OTP — billed per message via Twilio (≈$0.01–$0.05/msg)</p>
        <p>· Realtime concurrent connections above the plan limit</p>
        <p>· Vector embeddings / pgvector storage</p>
      </div>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function Row({
  label, value, accent,
}: {
  label: string
  value: string
  accent?: 'ok' | 'warn' | 'error'
}) {
  const valueClass = accent === 'error' ? 'text-red-400'
    : accent === 'warn' ? 'text-amber-400'
    : accent === 'ok'   ? 'text-emerald-400'
    : 'text-slate-300'

  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${valueClass}`}>{value}</span>
    </div>
  )
}
