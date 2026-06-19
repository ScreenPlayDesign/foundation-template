Feature: Sign-in page
  The entry point for unauthenticated visitors. Every SPD project starts here.
  FACADE — replace this feature file with your real user stories.
  Each scenario maps one-to-one to a Playwright spec in ../specs.

  @smoke
  Scenario: A visitor sees the sign-in page
    Given a visitor opens the app
    Then the login page is displayed
    And they see the app title and tagline
    And they see the Continue with Google button
    And the page matches the approved screenshot
