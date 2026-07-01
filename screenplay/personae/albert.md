---
persona: albert
device: Desktop Chrome
auth_method: email
env_prefix: ALBERT
avatar: /avatars/albert.svg
confidence: assumption
---

Albert is the first of the three starter actors — a placeholder for
whoever your first real user turns out to be. Tech-forward, precise,
always shipping something on the side; glasses, a hoodie-casual air, the
kind of person who reads the changelog. He signs in with email and
password by default (see `screenplay/tests/fixtures/auth.ts` and
`scripts/seed-actors.ts`) so the starter screenplay works without any
OAuth app configured — Google and GitHub sign-in are still there in
`App.tsx` whenever you're ready to wire them up for real.

His whole job is to answer one question: when someone signs in, does the
app correctly show *them* — their own name, their own avatar, their own
data — and only them? Give him a real name and a real reason to use the
app before you ship.
