---
persona: carol
device: Desktop Chrome
auth_method: email
env_prefix: CAROL
avatar: /avatars/carol.svg
confidence: assumption
---

Carol is the third starter actor — late twenties, grounded, the kind of
calm that comes from an actual practice, not just a vibe. She signs in
with email and password. Three is the minimum number that actually tests
concurrency and cross-user isolation at once — with only two, it's easy
to accidentally write a test that happens to pass because of ordering
rather than because the isolation is real. Carol is the canary for that
mistake, and she'll find your app's edge cases whether you meant her to
or not.
