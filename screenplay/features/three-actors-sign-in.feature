Feature: Three actors sign in with email
  Every SPD app starts by proving three real, simultaneous users can sign
  in and be told apart — using their own name, their own avatar, their own
  data. Email + password is the zero-setup default (see
  scripts/seed-actors.ts); Google and GitHub OAuth are wired into the app
  and ready to enable when you need them, but aren't required for this
  scene to pass. FACADE — replace Albert, Beth, and Carol with your actual
  cast once you know who your users are; keep the multi-actor pattern.

  Background:
    Given Albert, Beth, and Carol each have their own browser, signed out

  @e2e
  Scenario: Albert signs in with email and lands in the app
    When Albert signs in with his email and password
    Then Albert sees the app shell
    And Albert's profile shows his own name, his own avatar, and his own email

  @e2e
  Scenario: Beth signs in at the same time as Albert
    Given Albert is already signed in
    When Beth signs in with her email and password
    Then Beth sees the app shell with her own name, avatar, and email
    And Albert's session is unaffected by Beth signing in

  @e2e @smoke
  Scenario: All three actors are signed in simultaneously, side by side
    When Albert, Beth, and Carol each sign in with email and password
    Then all three see the app shell at the same time
    And each one's profile tab shows only their own name, avatar, and email
    And a screenshot is captured of all three side by side as proof
