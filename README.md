# spd-app-foundation-template

The ScreenPlayDesign **meta-foundation template** — the repo that defines the
underlying assumptions of the entire spd development-testing-deployment
system. Agencies build their own specialized templates (wedding apps, race
apps, festival apps) ON TOP of this foundation; the foundation itself never
changes per client. It is cloned via GitHub's template `/generate` API
whenever a new project is provisioned.

**The four assumptions this foundation encodes:**

1. **Stack** — Supabase backend, React 19 + Vite 8 + Tailwind 4 PWA frontend
   served through Cloudflare Pages, Stripe Connect payments. Opinionated, not configurable.
2. **Workflow** — strict `dev` → `staging` → `prod` git branches (`main` forbidden),
   promoted only through Gherkin-backed Playwright screenshot gates.
3. **Roles** — three human roles: `producer` (approves prod), `developer` (owns dev),
   `designer` (owns staging), each paired with an AI agent counterpart — plus the
   **`cornerpost` consulting slot**: the agency's chair, which can *step in for the
   developer and/or designer roles* for a consulting fee priced at the agency's
   own discretion (the platform default is Cornerpost Digital's $960/week).
4. **Identity** — one anchor email per project (`<slug>@cornerpostdigital.com`)
   that GitHub, Supabase, and Cloudflare all hang off — handoff is a single-thread transfer.

## Conventions clients inherit

- The spec lives in `screenplay/` (cast, setting, scenes) — see `screenplay/README.md`
- One Gherkin scenario ↔ one Playwright test; screenshots gate promotion
- `data-testid` anchors in components — the test suite depends on them
- Supabase migrations are additive, RLS on by default
- `spd_config.toml` is the project manifest the CLI and dashboard read
- Never push to `staging`/`prod` directly — use `spd promote`

## The starter screenplay

This template ships with a three-actor cast — Albert, Beth, and Carol
(`screenplay/personae/`), each with a distinctive avatar
(`public/avatars/`) — and one scene proving they can each sign in and be
told apart: their own name, their own avatar, their own data
(`screenplay/features/three-actors-sign-in.feature`). Rename or replace
them once you know who your real users are; keep the multi-actor pattern.
Run `spd screenplay check` to validate the folder still conforms to
convention after you do.

Sign-in is email + password by default — zero external setup, works the
moment `supabase start` is running:

```bash
supabase start
SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`> bun run seed:actors
bun run dev
# → sign in as albert@example.com / screenplay-dev-only (or beth/carol)
```

Google and GitHub OAuth are wired into `App.tsx` and enabled by default
per platform convention (`VITE_AUTH_PROVIDERS=google,github`), but the
starter screenplay doesn't depend on either being configured. The same
Playwright scenarios self-skip without `ALBERT/BETH/CAROL_TEST_EMAIL` +
`_TEST_PASSWORD` set:

```
ALBERT_TEST_EMAIL / ALBERT_TEST_PASSWORD
BETH_TEST_EMAIL   / BETH_TEST_PASSWORD
CAROL_TEST_EMAIL  / CAROL_TEST_PASSWORD
```

## Develop

```bash
bun install
cp .env.example .env
bun run dev           # localhost:5173
bun run seed:actors   # provision Albert, Beth, Carol (needs SUPABASE_SERVICE_ROLE_KEY)
bun run test          # Playwright + screenshot assertions
spd screenplay check  # validate screenplay/ conforms to convention
```

Keep this repo pristine and decoupled: it must never import from
`spd-web-dashboard`. Shared types come only from the platform's
`shared-contracts.ts`.
