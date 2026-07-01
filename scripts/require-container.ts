#!/usr/bin/env bun
/**
 * require-container.ts — refuses to let `bun run dev` / `bun run preview`
 * start unless it's running inside the project's Docker container.
 *
 * SPD projects are meant to run inside their own container, not on the bare
 * host — that's what makes "which Supabase stack is running," "which
 * project's credentials are active," and "one project container at a time"
 * mean anything. `spd dev` already re-execs into the container for you
 * (spd's own routing handles that transparently); this guard exists for
 * the case that actually slips through: someone bypassing `spd` entirely
 * and running `bun run dev` / `vite` directly.
 *
 * Wired as predev/prepreview in package.json. Only guards dev/preview —
 * NOT build/typecheck/test, which legitimately run bare on CI runners
 * (GitHub Actions isn't "the host" in the sense this guards against).
 *
 * Escape hatch: SPD_ALLOW_HOST_DEV=1 bun run dev — for the rare case Docker
 * itself is unavailable and you need to peek at the app anyway. Loud on
 * purpose (prints a warning) rather than silent, so it doesn't become the
 * accidental default habit.
 */

if (process.env.SPD_INSIDE_CONTAINER) {
  process.exit(0)   // already inside the container — nothing to do
}

if (process.env.SPD_ALLOW_HOST_DEV) {
  console.warn('\n  ⚠  SPD_ALLOW_HOST_DEV set — running on the host, bypassing the project container.')
  console.warn('     Supabase-claim and container-lifecycle guarantees do not apply here.\n')
  process.exit(0)
}

console.error(`
  ✗  This project is meant to run inside its Docker container, not on the host.

     Use:
       spd dev              — starts the container (if needed) and the dev server inside it

     spd's own routing already does this for \`spd <command>\` — this guard
     only catches bypassing spd entirely (e.g. running \`bun run dev\` or
     \`vite\` directly).

     If Docker genuinely isn't available and you need to peek at the app
     anyway:
       SPD_ALLOW_HOST_DEV=1 bun run dev
`)
process.exit(1)
