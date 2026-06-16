Feature: Landing page
  The first user story every SPD project ships with. Each scenario maps
  one-to-one to a Playwright spec in ../specs — keep them in sync.

  @smoke
  Scenario: A visitor sees the event landing page
    Given a visitor opens the app
    Then they see the event title
    And they see the tagline
    And the page matches the approved screenshot
