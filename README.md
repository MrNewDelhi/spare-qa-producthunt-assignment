# Spare QA Engineering Assignment - Product Hunt

This repo treats Product Hunt as the product under test and covers the assignment deliverables:

- `docs/test-strategy.md` - one-page QA strategy
- `docs/major-scenarios.md` - 10 major frontend/API scenarios to prioritize
- `docs/automation-architecture.md` - Playwright POM and API service architecture
- `docs/test-run-results.md` - latest local execution results and reproducibility status
- `docs/findings.md` and `docs/security-assessment.md` - exploratory and API/security findings
- `tests/e2e` - Playwright scenarios for the public web app
- `tests/api` - Bun + TypeScript GraphQL API tests

## Setup

```bash
bun install
cp .env.example .env
# Add PH_API_TOKEN to .env for authenticated API checks
bun run pw:install
```

Playwright is launched by its Node-based CLI through `bun run`; do not run Playwright specs with `bun test`.

## Run

```bash
bun run test:api
bun run test:e2e
bun run typecheck
```

The default scripts intentionally run the assignment-sized core suites: 6 API tests and 8 E2E scenarios. Token-gated API tests skip when `PH_API_TOKEN` is missing; unauthenticated auth-contract tests still run.

Extended defect-guard suites are available separately:

```bash
bun run test:api:extended
bun run test:e2e:extended
```

## Highest-Value Findings

The full report documents 100 confirmed findings and observations in `docs/findings.md`. The strongest interview-ready items are:

- Official API starter app omits OAuth `state` and stores a signed Product Hunt access token in a readable cookie without `HttpOnly`, `Secure`, or `SameSite`.
- Official starter proxy drops upstream GraphQL HTTP status and `x-rate-limit-*` headers, masking auth/rate-limit failures from developers who copy it.
- Official sample dependency stack is severely stale, including old `jsonwebtoken`, `isomorphic-fetch`/`node-fetch`, and `react-scripts`.
- Sponsor inquiry accepts `javascript:` in the company website field and advances the lead form, creating downstream stored unsafe-URL risk.
- Login carries untrusted external `origin` values into OAuth provider handoff URLs; callback validation should be completed in a disposable/staging account.
- Search pagination can render a production 500 for out-of-range pages, e.g. `/search?q=notion&page=10000`.
- Rate-limit debit appears flat for a tiny query and a broad aliased query, despite docs describing field-based complexity.
- GraphQL pagination silently accepts invalid cursors and silently clamps `first` above 20.
- GraphQL parser/contract edge cases return 500s or execute unexpectedly for malformed `query`, `variables`, and `operationName` inputs.
- Search result products are rendered as buttons even though they navigate like links.
- Public marketing/community pages have repeated SEO/a11y issues: missing or duplicated H1s, unnamed icon links, unnamed mobile menu, non-semantic validation, unlabeled rating radios, duplicate DOM IDs, and unnamed product action/review links.
- Base routes such as `/leaderboard/daily`, `/leaderboard/weekly`, `/leaderboard/monthly`, `/leaderboard/yearly`, `/products/new`, `/collections/new`, `/api`, `/docs`, `/community`, and `/alternatives` render self-canonical 404 pages instead of recovering.
- Product Hunt docs link to a dead Heroku API Explorer and show API dashboard URL drift.
- Machine-readable routes such as security/discovery/sitemap resources are missing or challenged in public checks.

## Architecture Decisions

| Decision | Choice |
|---|---|
| Runtime | Bun for package management and API tests |
| E2E | Playwright `1.61.1` Chromium through Node CLI |
| Frontend model | Page Object Model under `tests/e2e/pages`, injected through fixtures |
| Frontend waits | Playwright web-first assertions plus response/status waits; no hard sleeps or `networkidle` waits |
| API client | Thin typed `fetch` wrapper plus `ProductHuntApi` service object for tests |
| Data | Live read-only public data |
| Flake control | Web-first assertions, no hard waits, structural checks |
| Secrets | `PH_API_TOKEN` only from environment |

## Local Verification Note

See `docs/test-run-results.md` for the latest local execution record.

Current local status: TypeScript passes, Playwright discovers 64 E2E tests (32 on Chromium), the default `test:e2e` suite is exactly 8 `@core` Chromium scenarios, and Bun API tests run. The default `test:api` (core) suite passes **6/6** with a valid `PH_API_TOKEN`. Without the token, token-gated API tests are marked as skipped.

Cloudflare bot-management `403`s **headless** Chromium on the live site, so each blocked navigation is reported as an environment skip-with-reason (no sleeps, no bypass). Run **headed** locally (the default off-CI) and the challenge is passed, the app renders, and the real assertions execute — that is how the suite is verified.

**API rate limits:** the Product Hunt token has a 15-minute, complexity-based budget (`x-rate-limit-*` headers). The default core suite stays well under it. The opt-in extended suite (`test:api:extended`) is heavier — run it once per window, not in a tight loop, or you will exhaust the budget and see `429`-driven failures until `x-rate-limit-reset` elapses.
