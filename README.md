# Booking Search Automation

Playwright + TypeScript automation for three booking.com user-story scenarios: searching with specific traveler/date criteria, filtering results by budget and meal plan, and identifying the lowest-rated property from those results without using the site's own sort control.

## Tech stack

| Tool | Purpose |
|---|---|
| Playwright | Browser automation (Chromium, Firefox, WebKit) |
| Playwright Test | Test runner, assertions, fixtures, parallelism, reporting |
| TypeScript (strict mode) | Static typing, compile-time checks |
| Page Object Model | Separates test intent from UI implementation |

## Getting started

```bash
npm install
npx playwright install   # first time only, downloads browser binaries
npm test                 # run the full suite headless, all browsers
npm run test:headed      # same, with a visible browser
npm run typecheck        # tsc --noEmit
```

Reports are written to `reports/html-report`; open with `npx playwright show-report reports/html-report`.

## Project structure

```
fixtures/
  base.ts                # custom test fixtures (homePage, searchResultsPage)
pages/
  HomePage.ts             # search box: language, currency, destination, occupancy, dates, search
  SearchResultsPage.ts     # results page: budget/meal filters, rating extraction
test-data/
  scenario1.data.ts
  scenario2.data.ts
utils/
  dateHelper.ts            # relative-date math for "today + N" requirements
tests/
  scenario1.spec.ts
  scenario2.spec.ts
  scenario3.spec.ts
playwright.config.ts
tsconfig.json
```

## Architecture

```
                    Playwright Test Runner
                            │
                            ▼
                     Test Specifications
                  ┌─────────┼─────────┐
                  ▼         ▼         ▼
             Scenario 1  Scenario 2  Scenario 3
                  │         │         │
                  └─────────┼─────────┘
                            ▼
                     Custom Fixtures
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
              HomePage         SearchResultsPage
                  │                   │
                  └─────────┬─────────┘
                            ▼
                      booking.com

        Supporting layers: test data · date utilities · config · reports
```

Tests describe *what* should happen; page objects know *how* to do it against the live DOM. If booking.com changes a selector, it's a one-line fix in a page object, not a hunt through every spec file.

## Design decisions

**Playwright over Selenium.** Locator actions (`click`, `fill`, `check`) auto-wait for the element to become actionable, which is what let the whole suite avoid `waitForTimeout` entirely — the assignment explicitly ruled out direct delays. `@playwright/test` also bundles the runner, fixtures, assertions, retries, parallelism, and reporting, so no separate test framework was needed.

**TypeScript in strict mode.** Function signatures like `setOccupancy(adults: number, childrenAges: number[]): Promise<void>` document their own contract, and `strict: true` catches type mistakes before a test ever launches a browser.

**No hard-coded waits.** Every wait in the codebase is either Playwright's built-in actionability check, a web-first assertion (`expect(locator).toHaveAttribute(...)`, which retries until it passes or times out), or a bounded `expect(async () => {...}).toPass()` retry loop around a specific, verifiable condition (e.g., "the header now shows the selected language"). None of it is a blind `sleep()`.

**Path aliases.** `tsconfig.json` maps `@pages/*`, `@fixtures/*`, `@utils/*`, `@test-data/*` so imports read `from '@pages/HomePage'` instead of `from '../../pages/HomePage'`.

## Page objects

- **HomePage** wraps the search box: language and currency pickers, destination autocomplete, occupancy stepper, date picker, and the search button. Destination text is typed with `pressSequentially` rather than `fill`, because `fill` bypasses the keystroke listeners booking.com's autocomplete relies on to fetch real suggestions — using `fill` would leave the dropdown showing stale/default entries. The selected suggestion is matched by text (`.filter({ hasText: destination })`) rather than just clicking whatever comes first.
- **SearchResultsPage** wraps the results page: the budget range slider, the "Breakfast included" checkbox (scoped to the "Meals" filter group specifically, since the same filter is also shortcut-listed under "Popular filters"), and rating extraction from property cards.

## Fixtures

`fixtures/base.ts` extends Playwright's `test` with `homePage` and `searchResultsPage` fixtures. Each test receives ready-to-use page objects instead of constructing them manually:

```ts
test('Scenario 1', async ({ homePage, searchResultsPage }) => {
  await homePage.selectLanguage(...);
  ...
});
```

The `homePage` fixture also handles first-load housekeeping (navigating to the site, dismissing the cookie banner) so every spec starts from the same clean state.

## Test data

Scenario inputs live in `test-data/`, separate from the test steps that use them, so values can change without touching test logic:

```ts
// test-data/scenario1.data.ts
export const scenario1Data = {
  destination: 'Stockholm',
  adults: 2,
  childrenAges: [8],
  checkInOffsetDays: 5,
  checkOutOffsetDays: 9,
};
```

## Date handling

The brief specifies dates as "today + 5" / "today + 9" rather than fixed calendar dates, so `utils/dateHelper.ts` computes them at run time (`addDaysToToday`) and converts the result to the `YYYY-MM-DD` format booking.com's calendar cells use (`toCalendarDateAttr`, matching `span[data-date="..."]`). This keeps the suite valid indefinitely instead of hard-coding dates that would eventually fall in the past. Calendar navigation clicks "Next month" until the target date cell is actually visible, rather than assuming it's on the currently displayed page.

## Scenarios

- **Scenario 1** — set language, enter destination, set occupancy and dates, search, and confirm the results reflect the requested destination without hitting a sign-in/registration wall.
- **Scenario 2** — from the results page, set a budget range (via the native range slider, since booking.com's budget control isn't a text input), filter by "Breakfast included," and confirm results update.
- **Scenario 3** — find the lowest-rated property *without* using booking.com's own rating sort.

Scenarios 2 and 3 re-run the search/filter steps from Scenario 1 rather than depending on it running first. Each test builds its own precondition state, so a failure in one scenario doesn't cascade into unrelated failures in the others.

### Finding the lowest-rated property (Scenario 3)

`getPropertyRatings()` reads every visible property card's name and score directly from the DOM (parsing the first decimal number out of text like `"Scored 8.9 8.9Excellent 6,248 reviews"`, rather than stripping all non-digits, which would otherwise mash the score and review count into one garbage number). `findLowestRatedProperty()` then reduces that list to the minimum in a single pass:

```ts
return ratings.reduce((lowest, current) =>
  current.rating < lowest.rating ? current : lowest
);
```

This is a plain O(n) scan — no sorting, and no use of the site's "Property rating: low to high" control, per the requirement.

## Configuration

`playwright.config.ts`:

- **Layered timeouts** — `timeout` (overall test), `expect.timeout` (assertions), `actionTimeout`/`navigationTimeout` (individual actions/navigations) — bound how long the suite waits without either hanging indefinitely or failing on normal network variance.
- **`fullyParallel: true`** — scenarios run concurrently to keep suite time down.
- **CI-aware retries/workers** — `retries: 2` and `workers: 2` under `process.env.CI`, `0`/unlimited locally, so local runs surface genuine failures immediately while CI absorbs transient flakiness.
- **`forbidOnly: !!process.env.CI`** — a stray `test.only()` fails CI instead of silently running one test and reporting green.
- **Three browser projects** — Chromium, Firefox, and WebKit, so the suite isn't validated against one engine only.
- **Reporting and artifacts** — HTML + list reporters; screenshots on failure, video retained on failure, trace captured on first retry. Nothing is generated for passing runs, but a failure leaves enough evidence (screenshot, video, trace) to diagnose without re-running.

## Known booking.com behaviors this suite works around

booking.com's UI has a few live-site quirks that aren't obvious from a single manual run:

- **Geo-detected locale/currency.** Language and currency default based on IP, not a fixed value, and switching either redirects through an intermediate confirmation page before landing back on the target locale — during which the page can briefly detach and re-attach. Picker selection is wrapped in a bounded retry (`expect(async () => {...}).toPass()`) that re-attempts the whole open → select → confirm sequence rather than a single fire-and-forget click.
- **A delayed sign-in overlay** can appear after initial page load and intercept clicks on the header, more consistently on Firefox. Interactions that touch the header press `Escape` and use `force: true` to clear a stray empty focus-trap wrapper that Playwright's actionability check otherwise treats as blocking.
- **The budget filter is a native `<input type="range">` pair**, not a text field — set via the native value setter plus dispatched `input`/`change` events, since React-controlled range inputs ignore a plain attribute set.
