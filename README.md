# Spare QA Engineering Assignment - Product Hunt

This repo treats Product Hunt as the product under test and covers the assignment deliverables.

**Documentation (`docs/`)**

| File | What it covers |
|---|---|
| [`test-strategy.md`](docs/test-strategy.md) | One-page, risk-based QA strategy (Part 1) |
| [`findings.md`](docs/findings.md) | Exploratory testing log — 100 findings with repro/evidence/severity (Part 2) |
| [`security-assessment.md`](docs/security-assessment.md) | Focused security observations on the app + GraphQL API (Part 2) |
| [`major-scenarios.md`](docs/major-scenarios.md) | The major frontend/API scenarios, prioritized |
| [`test-cases.md`](docs/test-cases.md) | Detailed manual/automated test-case catalogue |
| [`automation-architecture.md`](docs/automation-architecture.md) | Playwright POM + API service architecture and decisions |
| [`api-reference.md`](docs/api-reference.md) | Product Hunt GraphQL notes used to design the API suite |
| [`test-run-results.md`](docs/test-run-results.md) | Latest local execution record + reproducibility status |
| [`jira/frontend-tickets.md`](docs/jira/frontend-tickets.md), [`jira/api-tickets.md`](docs/jira/api-tickets.md) | Findings written up as engineering-ready tickets |

**Tests**

- [`tests/e2e`](tests/e2e) — Playwright scenarios for the public web app (Page Object Model)
- [`tests/api`](tests/api) — Bun + TypeScript GraphQL API tests (typed service layer)

## Setup

**Prerequisites:** [Bun](https://bun.sh) `>= 1.3`. Playwright's Chromium is installed by the `pw:install` script below.

```bash
bun install                 # install dependencies
cp .env.example .env        # create your local env file
# Edit .env and set PH_API_TOKEN=<your token> for the authenticated API tests.
# A free developer token: https://www.producthunt.com/v2/oauth/applications
bun run pw:install          # install Playwright's Chromium (+ deps)
```

> Playwright is launched by its Node-based CLI via `bun run` (the `test:e2e*` scripts). Do **not** run Playwright specs with `bun test` — that is only for the API suite.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PH_API_TOKEN` | For API tests | Bearer token for the GraphQL API. Token-gated tests skip cleanly if absent (CI fails loudly instead). |
| `PH_API_URL` | No | GraphQL endpoint. Defaults to the public Product Hunt URL. |
| `PH_WEB_BASE_URL` | No | Web app base URL for E2E. Defaults to `https://www.producthunt.com`. |
| `PW_HEADLESS` | No | `0` forces headed, `1` forces headless. Defaults to headed locally / headless in CI. |
| `PH_CF_BYPASS_HEADER` | No | `"<header>: <secret>"` to pass an owner-side WAF allow header in bot-gated envs. |
| `PH_FORCE_RATE_LIMIT_SKIP` | No | `1` forces the API rate-limit skip path (for demos). |

## How to run

| Command | What it does |
|---|---|
| `bun run typecheck` | TypeScript type-check (`tsc --noEmit`) |
| `bun run test:api` | **Core API suite** — 6 typed GraphQL tests (the graded default) |
| `bun run test:e2e` | **Core E2E suite** — 8 `@core` Chromium scenarios (the graded default) |
| `bun run test:api:extended` | Full API suite — 27 tests incl. security & defect guards |
| `bun run test:e2e:extended` | Full E2E suite — all specs, both projects (Chromium + Pixel 7) |
| `bun run test:e2e:smoke` | `@smoke`-tagged scenarios only |
| `bun run test:e2e:mobile` | `@core` scenarios on the mobile (Pixel 7) project |
| `bun run test:e2e:ui` | Playwright interactive UI mode |
| `bun run report` | Open the last Playwright HTML report |

The default `test:api` / `test:e2e` scripts run the assignment-sized core suites (6 API tests, 8 E2E scenarios). Token-gated API tests skip when `PH_API_TOKEN` is missing; the unauthenticated auth-contract tests still run.

## Continuous Integration

`.github/workflows/ci.yml` runs two jobs on every push/PR:

- **api** — typecheck + the full API suite (`test:api:extended`). The token comes from a **GitHub Actions secret**, never the repo: `PH_API_TOKEN: ${{ secrets.PH_API_TOKEN }}`. The `preflight` test fails loudly if the secret is missing, so a run can never go green by silently skipping authenticated coverage.
- **e2e** — installs Chromium and runs the core suite headless; the optional `PH_CF_BYPASS_HEADER` secret is passed through for owner-side WAF allowlisting, and the Playwright report is uploaded as an artifact on failure.

**To enable CI after forking/cloning:** add the secret in **Settings → Secrets and variables → Actions → New repository secret**, named `PH_API_TOKEN` (and optionally `PH_CF_BYPASS_HEADER`).

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

## What I'd Do With More Time

- **Stable E2E environment:** a non-bot-gated staging URL or an owner-side WAF
  allowlist so headless CI runs deterministically instead of skipping on
  Cloudflare `403`s.
- **Schema contract snapshots:** GraphQL codegen + typed operations and a
  schema-diff check in CI to catch breaking changes before customers do.
- **Sandbox OAuth + mutation coverage:** disposable accounts to safely test
  authenticated write flows (votes, follows, comments) that are out of scope here.
- **Accessibility automation:** `axe-core` scans wired into the E2E pages to turn
  the manual a11y/SEO findings into regression guards.
- **Operationalise at scale:** dedicated CI token, sharded Playwright runs,
  JUnit/blob reporting into a dashboard, and synthetic production monitoring on
  the core read journeys and the GraphQL endpoint.
- **Visual + cross-browser regression** for the high-traffic discovery pages.

## Local Verification Note

See `docs/test-run-results.md` for the latest local execution record.

Current local status: TypeScript passes, Playwright discovers 64 E2E tests (32 on Chromium), the default `test:e2e` suite is exactly 8 `@core` Chromium scenarios, and Bun API tests run. The default `test:api` (core) suite passes **6/6** with a valid `PH_API_TOKEN`. Without the token, token-gated API tests are marked as skipped.

Cloudflare bot-management `403`s **headless** Chromium on the live site, so each blocked navigation is reported as an environment skip-with-reason (no sleeps, no bypass). Run **headed** locally (the default off-CI) and the challenge is passed, the app renders, and the real assertions execute — that is how the suite is verified.

**API rate limits:** the Product Hunt token has a 15-minute, complexity-based budget (`x-rate-limit-*` headers). The default core suite stays well under it; the opt-in extended suite (`test:api:extended`) is heavier — run it once per window with a dedicated token rather than in a tight loop. A one-time memoized preflight (`tests/api/rate-limit.ts`) probes the budget before tests register: if the token is already over budget, token-gated tests **skip-with-reason** instead of producing a misleading red cascade of `429`s (the same philosophy as the E2E Cloudflare guard). Force that path for a demo with `PH_FORCE_RATE_LIMIT_SKIP=1`.
