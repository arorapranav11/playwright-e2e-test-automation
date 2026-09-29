# Playwright + TypeScript E2E Automation Framework

A practical Quality Engineering portfolio exercising search and filtering on the live Booking.com website. It demonstrates page-object design, test-scoped fixtures, independent scenarios, dynamic test data, cross-browser configuration, and CI failure diagnostics—with explicit limits around third-party reliability and assertion coverage.

**Stack:** Playwright Test · strict TypeScript · Node.js · GitHub Actions

**Scope:** three live-site scenarios across Chromium, Firefox, and WebKit, plus three synthetic-DOM regression checks per browser for rating extraction. No account creation, reservation submission, or payment automation.

## Quick start

Use Node.js 24 or newer (CI uses Node 24), npm, and Git. Browser downloads and live tests need network access.

```bash
git clone https://github.com/arorapranav11/playwright-e2e-test-automation.git
cd playwright-e2e-test-automation
npm ci
npx playwright install --with-deps
npm run typecheck
npm run test:framework       # local DOM checks; no Booking.com requests
npm run test:chromium        # framework checks + live scenarios, one browser
npm run report
```

Linux browser dependency installation may require administrator access. The full suite is `npm test`. Live-site failures must be investigated; configured browser coverage is not a claim that every browser currently passes.

## Engineering highlights

- Page objects centralize UI interactions; specs retain scenario intent and outcome assertions.
- Custom fixtures create page objects around each test's isolated Playwright page/context.
- Inputs are separate from test steps; calendar dates are relative to execution day.
- Auto-waiting, web-first assertions, and bounded interaction retries replace arbitrary sleeps.
- Three browser projects share configuration; CI limits workers, retries failed tests, and rejects `test.only`.
- HTML reports and failure attachments support diagnosis; synthetic-DOM checks exercise parsing without live-site dependencies.

## Architecture and repository map

`test specs → test-scoped fixtures → page objects → Booking.com`

Scenario data and date utilities support the specs. Playwright configuration supplies browser projects, timeouts, retries, and diagnostics. Framework regression tests instantiate `SearchResultsPage` directly against `page.setContent()`; they bypass the navigation fixture.

```text
.github/workflows/playwright.yml  # CI validation and browser execution
.gitignore                       # generated/local artifacts
fixtures/base.ts                  # homePage and searchResultsPage fixtures
pages/HomePage.ts                 # search, locale, occupancy, calendar
pages/SearchResultsPage.ts        # filters and rating extraction
test-data/scenario1.data.ts       # destination, occupants, relative dates, language
test-data/scenario2.data.ts       # currency and budget
tests/scenario1.spec.ts           # search without registration
tests/scenario2.spec.ts           # budget and breakfast interactions
tests/scenario3.spec.ts           # lowest loaded property score
tests/framework/searchResults.spec.ts # synthetic-DOM regression checks
utils/dateHelper.ts               # local-calendar date arithmetic/formatting
package.json                     # metadata and runnable scripts
package-lock.json                # reproducible dependency resolution
playwright.config.ts              # browser/runtime/report settings
tsconfig.json                    # strict typing and path aliases
README.md
```

## Test scope and assertions

| Scenario | Actions | What is verified |
| --- | --- | --- |
| 1: search | English (US), Stockholm, two adults and an eight-year-old child, check-in +5 days / check-out +9 days | Destination appears in the results heading; URL is not a sign-in/registration route |
| 2: filters | Independent search in SEK; budget 2,000–10,000 and breakfast included | A property card is visible after filter interactions |
| 3: rating analysis | Independent search and filter setup; read loaded property cards | A lowest-scoring property is returned with a positive score |
| Framework checks | Synthetic cards including ties, unrated, invalid, blank-name, and empty results | Exact extracted scores, first minimum on ties, and a descriptive no-rated-properties error |

The live assertions do **not** verify every returned price/meal entitlement, every search parameter, or that an asynchronous filter refresh has completed. A visible card can predate the refresh. Scenario 3 examines only currently loaded DOM cards, not all inventory, pagination, or an exhaustive destination-wide minimum. The synthetic checks prove local extraction behavior, not compatibility with future Booking.com markup.

## Design decisions

### Page objects and fixtures

`HomePage` owns header pickers, destination suggestions, occupancy, dates, and search. `SearchResultsPage` owns filter controls and rating extraction. Centralizing selectors reduces duplication, but a UI redesign can still require changes across methods and tests.

The `homePage` fixture navigates to the base URL, attempts cookie dismissal, and presses Escape for possible overlays. The `searchResultsPage` fixture only constructs its page object. Each scenario establishes its own prerequisites: no shared logged-in state or reliance on a prior scenario passing. The short repeated search setup remains explicit rather than adding another abstraction.

### Data, dates, and TypeScript

Inputs live in `test-data/`. `addDaysToToday()` computes local-midnight dates; `toCalendarDateAttr()` formats local `YYYY-MM-DD` values for calendar selectors. Calendar navigation is capped at 24 forward clicks. Relative dates avoid stale fixed dates but cannot guarantee availability or prevent a site/time-zone mismatch.

Strict TypeScript and `@pages/*`, `@fixtures/*`, `@utils/*`, `@test-data/*` aliases keep imports and contracts readable. Playwright executes TypeScript; `npm run typecheck` is the separate static validation step. No build output is required.

### Synchronization and live UI tradeoffs

Locator actionability checks and retrying assertions handle routine waits. Language/currency and destination interactions use bounded 30-second `toPass()` blocks to handle redirects and detached UI. Destination entry uses sequential keystrokes before selecting a matching suggestion. Search waits for a URL change and page load.

Header picker clicks currently use `force: true` after Escape to work around interfering overlays. Cookie dismissal tolerates errors, and occupancy steppers track clicks rather than asserting each resulting value. These are existing compromises, not universal resilience guarantees. Arbitrary `waitForTimeout` calls are absent from framework/test source.

Budget controls are scoped to the price group; breakfast is scoped to the meal-plan group to avoid duplicate shortcut filters. Range inputs use the native value setter and dispatch `input`/`change` events. This is a DOM-level interaction, not proof of user-equivalent drag behavior or server-side filter application.

### Rating extraction

The page object reads the first numeric token in English review-score text, accepts finite scores in `(0, 10]` with nonblank names, and skips unrated/invalid cards. This avoids concatenating a decimal score with a review count. Parsing still depends on the expected English DOM format; changed markup or localized decimal separators need review.

The minimum uses a single O(n) scan, retaining the first property on ties, without using the site's sort control. No usable scores produces a contextual error rather than an empty-array `reduce` exception.

## Execution and debugging

| Command | Purpose |
| --- | --- |
| `npm test` | All six tests in all three browser projects (18 executions) |
| `npm run test:headed` | Same suite in visible browsers |
| `npm run test:chromium` | Chromium only |
| `npm run test:firefox` | Firefox only |
| `npm run test:webkit` | WebKit only |
| `npm run test:framework` | Three local DOM checks across all browsers (9 executions) |
| `npm run typecheck` | TypeScript validation without emitting files |
| `npm run report` | Open the most recent HTML report |

```bash
# One live scenario, with Playwright Inspector
npm run test:chromium -- tests/scenario1.spec.ts --debug

# Capture a trace on the initial attempt, including local runs with no retries
npm run test:chromium -- tests/scenario1.spec.ts --trace on

# Reduce simultaneous live-site requests when diagnosing failures
npm test -- --workers=1
```

## Configuration

`playwright.config.ts` is the runtime source of truth:

| Setting | Value |
| --- | --- |
| Base URL | `BASE_URL` environment variable, otherwise `https://www.booking.com` |
| Projects | Desktop Chromium, Firefox, WebKit |
| Test / assertion timeout | 60 seconds / 10 seconds |
| Action / navigation timeout | 15 seconds / 30 seconds |
| Parallelism | `fullyParallel: true`; CI uses 2 workers, local uses Playwright's default |
| Whole-test retries | 2 in CI, 0 locally |
| Focused tests | Forbidden when `CI` is nonempty |

`CI` is checked for a nonempty environment value: even `CI=false` activates CI settings. `BASE_URL` does not make the page objects generic; they require Booking.com-compatible markup. Environment variables must be exported by the shell/runner; `.env` files are **not** automatically loaded. No credentials are needed by these unauthenticated scenarios.

## CI and diagnostics

[GitHub Actions workflow](.github/workflows/playwright.yml) runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It uses Ubuntu, Node 24, npm caching, `npm ci`, typechecking, browser/system dependency installation, then `npm test` across all projects. The job has a 20-minute timeout, read-only repository permissions, and cancels superseded runs on the same ref. There is no deployment stage.

The workflow follows the [Playwright CI setup](https://playwright.dev/docs/ci). It does not suppress test failures. In the repository's **Actions** tab, open a run to inspect logs and download `playwright-reports` (14-day retention). Reports are uploaded after success or failure when present, unless the run was cancelled.

- `reports/html-report/`: HTML report for passing **and** failing runs.
- `reports/test-results/`: per-test output, including screenshots on failure and video retained on failure.
- Traces: captured on the first retry. Default local runs have no retry, so use `--trace on` when needed. Failures before browser startup may have no screenshot/video.

Both directories are included in the CI artifact and ignored by Git. Each run replaces the previous local report. Reports/traces can contain page content and URLs; review before sharing and do not use real account credentials.

## Known limitations

This suite targets a live third-party application, not a controlled test environment. UI experiments, localization/geolocation, network behavior, bot protection, availability, inventory, and prices can change independently of this repository. Retries provide diagnostic opportunities, not a guarantee against flaky results. Do not bypass bot protection or increase traffic aggressively when investigating failures.

There is no controlled backend, API contract suite, accessibility audit, performance measurement, visual baseline, coverage percentage, or guarantee that every live scenario currently passes. Cross-browser configuration is implemented; passing results must be evidenced by a specific run. The package retains its existing ISC metadata; no new license grant is introduced by this upgrade.

## Future improvements (not implemented)

- Verify selected search parameters and applied filter state, including a reliable results-refresh signal.
- Add deterministic date-boundary and occupancy tests, and tighter calendar/stepper diagnostics.
- Revisit forced header clicks and broad optional-cookie error handling against captured real failures.
- Add controlled fixtures/mocked responses if a stable test environment becomes available.
- Clarify standalone license terms with the repository owner before wider reuse.

These are follow-up opportunities, not current capabilities.
