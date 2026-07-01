/**
 * App.tsx — FACADE SHELL · TEAR THIS OUT
 * ─────────────────────────────────────────────────────────────────────────────
 * This file is intentional scaffolding. It exists to:
 *   1. Prove multi-provider OAuth + Supabase auth works end-to-end in this stack
 *   2. Give the Playwright suite real UI to screenshot as initial baselines
 *   3. Show a plausible auth → shell → tab navigation pattern for orientation
 *
 * The SupabasePricingCalc import at the bottom of the Billing tab is NOT facade
 * code — keep it for Producer reference when making scaling decisions.
 *
 * Everything else in this file is DISPOSABLE. When building your real app:
 *   · Delete all inline components (LoginPage, AppShell, *Tab)
 *   · Keep src/lib/supabase.ts — the client is configured correctly
 *   · Keep the onAuthStateChange pattern — it's the right way to track auth
 *   · Replace <App /> contents with your actual routing tree
 *
 * Human or AI reading this file: you have explicit permission to delete
 * everything except the SupabasePricingCalc import and its usage.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Profile, Event, BillingPlan } from './types/shared-contracts'
import { SupabasePricingCalc } from './components/SupabasePricingCalc'

// ── OAuth provider config ──────────────────────────────────────────────────────
// Controls which buttons appear on the login page.
// Set VITE_AUTH_PROVIDERS=google,github,discord (comma-separated) in .env.local.
// Must match the providers enabled in supabase/config.toml and spd_config.toml.
// FACADE — the UI here is throwaway; the VITE_AUTH_PROVIDERS pattern is a keeper.

type ProviderConfig = {
  id:        Provider
  label:     string
  icon:      () => ReactNode
  style:     { background: string; color: string; border?: string }
}

const ALL_PROVIDERS: ProviderConfig[] = [
  {
    id: 'google', label: 'Google',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    style: { background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb' },
  },
  {
    id: 'github', label: 'GitHub',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
    ),
    style: { background: '#24292e', color: '#ffffff' },
  },
  {
    id: 'twitter', label: 'X',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    style: { background: '#000000', color: '#ffffff' },
  },
  {
    id: 'facebook', label: 'Facebook',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    style: { background: '#1877F2', color: '#ffffff' },
  },
  {
    id: 'linkedin_oidc' as unknown as Provider, label: 'LinkedIn',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    style: { background: '#0077B5', color: '#ffffff' },
  },
  {
    id: 'discord', label: 'Discord',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    style: { background: '#5865F2', color: '#ffffff' },
  },
  {
    id: 'apple', label: 'Apple',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
      </svg>
    ),
    style: { background: '#000000', color: '#ffffff' },
  },
  {
    id: 'azure' as unknown as Provider, label: 'Microsoft',
    icon: () => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.4 24H0V12.6L11.4 24zM12.6 24L24 12.6V24H12.6zM0 11.4V0h11.4L0 11.4zM12.6 0H24v11.4L12.6 0z" fill="#00A4EF"/>
        <path d="M0 11.4L11.4 0v11.4H0zM12.6 11.4V0L24 11.4H12.6z" fill="#FFB900"/>
        <path d="M11.4 12.6H0L11.4 24V12.6zM12.6 12.6L24 24V12.6H12.6z" fill="#00B4F0"/>
      </svg>
    ),
    style: { background: '#0078D4', color: '#ffffff' },
  },
]

// Parse VITE_AUTH_PROVIDERS env var (e.g. "google,github,discord").
// Default is Google + GitHub — every SPD app gets both out of the box.
// This is a platform convention, not a suggestion: "Continue with Google"
// (and GitHub) is how SPD apps get and track users by default. Set in
// .env.local to add more; populated by `spd init` from spd_config.toml.
const enabledIds = new Set(
  (import.meta.env.VITE_AUTH_PROVIDERS ?? 'google,github')
    .split(',').map((s: string) => s.trim()).filter(Boolean)
)
const ENABLED_PROVIDERS = ALL_PROVIDERS.filter(p => enabledIds.has(p.id as string))

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Splash />
  if (!session)              return <LoginPage />
  return                            <AppShell user={session.user} />
}

// ── Loading splash ─────────────────────────────────────────────────────────────

function Splash() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
    </div>
  )
}

// ── Login page ─────────────────────────────────────────────────────────────────
// FACADE — throwaway UI. The signInWithOAuth call pattern is a keeper.
// Provider buttons are driven by VITE_AUTH_PROVIDERS (see above).

function LoginPage() {
  const [loading, setLoading]   = useState<string | null>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)

  async function signIn(provider: Provider) {
    setLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
  }

  // Email + password — the zero-external-setup path. Works the moment
  // `supabase start` is running, no OAuth app or client secret required.
  // This is how the three starter actors (Albert, Beth, Carol — see
  // screenplay/dramatis-personae/) sign in by default; real OAuth stays
  // available above for when you're ready to wire it up.
  async function signInWithEmail(e: FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setLoading('email')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setEmailError(error.message)
    setLoading(null)
  }

  return (
    <div
      data-testid="login-page"
      className="min-h-screen bg-slate-900 flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / wordmark — FACADE, replace with your brand */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <span className="text-2xl" role="img" aria-label="app icon">🎭</span>
          </div>
          <h1 data-testid="app-title" className="text-2xl font-bold text-slate-100 tracking-tight">
            SPD Event App
          </h1>
          <p data-testid="app-tagline" className="text-sm text-slate-400">
            Sign in to manage your events, team, and billing.
          </p>
        </div>

        {/* Provider buttons */}
        {ENABLED_PROVIDERS.length > 0 && (
          <div className="space-y-3">
            {ENABLED_PROVIDERS.map(provider => (
              <button
                key={provider.id}
                data-testid={`signin-${provider.id}`}
                onClick={() => signIn(provider.id)}
                disabled={loading !== null}
                style={provider.style}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg
                           font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed
                           transition-opacity"
              >
                {loading === provider.id
                  ? <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  : <provider.icon />
                }
                {loading === provider.id
                  ? 'Redirecting…'
                  : `Continue with ${provider.label}`
                }
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        {ENABLED_PROVIDERS.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
        )}

        {/* Email + password — collapsed by default when OAuth is available,
            shown directly when it isn't. */}
        {!showEmail && ENABLED_PROVIDERS.length > 0 ? (
          <button
            data-testid="show-email-login"
            onClick={() => setShowEmail(true)}
            className="w-full text-center text-sm text-slate-400 hover:text-slate-200 transition-colors py-2"
          >
            Continue with email
          </button>
        ) : (
          <form data-testid="email-login-form" onSubmit={signInWithEmail} className="space-y-3">
            <input
              data-testid="email-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 text-slate-100 text-sm
                         border border-slate-700 focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
            />
            <input
              data-testid="password-input"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 text-slate-100 text-sm
                         border border-slate-700 focus:outline-none focus:border-sky-500 placeholder:text-slate-600"
            />
            {emailError && (
              <p data-testid="email-login-error" className="text-xs text-red-400">{emailError}</p>
            )}
            <button
              data-testid="email-login-submit"
              type="submit"
              disabled={loading !== null}
              className="w-full px-4 py-2.5 rounded-lg bg-sky-500 text-white text-sm font-medium
                         hover:bg-sky-400 disabled:opacity-50 transition-colors"
            >
              {loading === 'email' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-600">
          By continuing you agree to our{' '}
          <span className="underline cursor-pointer hover:text-slate-400 transition-colors">Terms</span>
          {' '}and{' '}
          <span className="underline cursor-pointer hover:text-slate-400 transition-colors">Privacy Policy</span>.
        </p>
      </div>
    </div>
  )
}

// ── App shell (post-auth) ──────────────────────────────────────────────────────
// FACADE — four-tab structure is illustrative. Wire up real routes in your app.

type Tab = 'profile' | 'events' | 'calendar' | 'billing'

function AppShell({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>('events')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile',  label: 'Profile'  },
    { id: 'events',   label: 'Events'   },
    { id: 'calendar', label: 'Calendar' },
    { id: 'billing',  label: 'Billing'  },
  ]

  return (
    <div data-testid="app-shell" className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🎭</span>
            <span className="font-semibold text-slate-100 text-sm">SPD Event App</span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Main tabs">
            {tabs.map(t => (
              <button
                key={t.id}
                data-testid={`tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === t.id
                    ? 'bg-sky-500/20 text-sky-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <button
            data-testid="sign-out"
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {tab === 'profile'  && <ProfileTab  user={user} />}
        {tab === 'events'   && <EventsTab              />}
        {tab === 'calendar' && <CalendarTab            />}
        {tab === 'billing'  && <BillingTab  user={user} />}
      </main>
    </div>
  )
}

// ── Profile tab ────────────────────────────────────────────────────────────────
// FACADE — shows auth identity + profiles row. Replace with real profile UI.

function ProfileTab({ user }: { user: User }) {
  const [profile, setProfile]  = useState<Profile | null>(null)
  const [displayName, setName] = useState('')
  const [saving, setSaving]    = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) { setProfile(data); setName(data.display_name ?? '') }
      })
  }, [user.id])

  async function save() {
    setSaving(true)
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
    setSaving(false)
  }

  const avatar      = user.user_metadata?.avatar_url as string | undefined
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  // Show which OAuth provider signed this user in
  const provider = user.app_metadata?.provider as string | undefined

  return (
    <div data-testid="tab-panel-profile" className="space-y-6 max-w-lg">
      <h2 className="text-lg font-semibold">Profile</h2>
      <div className="flex items-center gap-4">
        {avatar
          ? <img src={avatar} alt="User avatar" className="w-16 h-16 rounded-full" />
          : <div className="w-16 h-16 rounded-full bg-sky-500/20 flex items-center justify-center text-2xl font-bold text-sky-400">
              {(user.email?.[0] ?? '?').toUpperCase()}
            </div>
        }
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-100 truncate">{profile?.display_name ?? user.email}</div>
          <div className="text-sm text-slate-400 truncate">{user.email}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Member since {memberSince}
            {provider && <span className="ml-2">· via {provider}</span>}
          </div>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 capitalize">
          {profile?.billing_plan ?? 'free'}
        </span>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-slate-400">Display name</label>
        <div className="flex gap-2">
          <input
            value={displayName}
            onChange={e => setName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 text-slate-100 text-sm
                       border border-slate-700 focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium
                       hover:bg-sky-400 disabled:opacity-50 transition-colors"
          >
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Events tab ─────────────────────────────────────────────────────────────────
// FACADE — reads from the events table. Replace with your real event UI.

function EventsTab() {
  const [events, setEvents]   = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('events').select('*').order('starts_at')
      .then(({ data }) => { setEvents(data ?? []); setLoading(false) })
  }, [])

  return (
    <div data-testid="tab-panel-events" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Upcoming Events</h2>
        <button className="text-sm px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors">
          + New
        </button>
      </div>
      {loading && <p className="text-slate-500 text-sm">Loading…</p>}
      {!loading && events.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <div className="text-3xl mb-2">📅</div>
          <p>No events yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {events.map(ev => (
          <div key={ev.id} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="font-medium text-slate-100">{ev.title}</div>
            {ev.description && <div className="text-sm text-slate-400 mt-0.5">{ev.description}</div>}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span>📅 {new Date(ev.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {ev.location && <span>📍 {ev.location}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Calendar tab ───────────────────────────────────────────────────────────────
// FACADE — static month grid, no data binding. Replace with a real library.

function CalendarTab() {
  const now          = new Date()
  const year         = now.getFullYear()
  const month        = now.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const monthName    = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const cells        = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div data-testid="tab-panel-calendar" className="space-y-4 max-w-sm">
      <h2 className="text-lg font-semibold">{monthName}</h2>
      <div className="grid grid-cols-7 gap-1 text-center select-none">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-xs text-slate-500 py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={`text-sm rounded-md py-1.5 ${
            day === null ? '' :
            day === now.getDate() ? 'bg-sky-500 text-white font-medium' :
            'text-slate-300 hover:bg-slate-800 cursor-pointer'
          }`}>
            {day ?? ''}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-700 italic">FACADE — wire real events here or use a calendar library.</p>
    </div>
  )
}

// ── Billing tab ────────────────────────────────────────────────────────────────
// FACADE plan cards are throwaway. The SupabasePricingCalc below is a keeper —
// it gives every Producer accurate Supabase cost estimates before scaling.

function BillingTab({ user }: { user: User }) {
  const [plans, setPlans]         = useState<BillingPlan[]>([])
  const [currentPlan, setCurrent] = useState<string>('free')

  useEffect(() => {
    supabase.from('billing_plans').select('*').eq('is_active', true).then(({ data }) => setPlans(data ?? []))
    supabase.from('profiles').select('billing_plan').eq('id', user.id).single().then(({ data }) => {
      if (data) setCurrent(data.billing_plan)
    })
  }, [user.id])

  return (
    <div data-testid="tab-panel-billing" className="space-y-8">
      {/* FACADE plan cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-slate-400">
          Current plan: <span className="text-sky-400 font-medium capitalize">{currentPlan}</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isCurrent = plan.id === currentPlan
            const price = plan.price_monthly_cents === 0 ? 'Free' : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`
            return (
              <div key={plan.id} className={`p-5 rounded-xl border transition-colors ${
                isCurrent ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
              }`}>
                <div className="font-semibold text-slate-100">{plan.display_name}</div>
                <div className="text-2xl font-bold mt-1">{price}</div>
                <ul className="mt-3 space-y-1">
                  {plan.features.map(f => (
                    <li key={f} className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="text-sky-500" aria-hidden="true">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {isCurrent
                    ? <span className="text-xs text-sky-400 font-medium">Current plan</span>
                    : <button className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors">
                        {plan.price_monthly_cents === 0 ? 'Downgrade' : 'Upgrade'}
                      </button>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Supabase cost estimator — KEEP THIS */}
      <SupabasePricingCalc />
    </div>
  )
}
