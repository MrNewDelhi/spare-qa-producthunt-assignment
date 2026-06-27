# Task List — Spare QA Engineering Assignment

## 🎯 Goal

Deliver a public GitHub repo that demonstrates ownership of quality for **Product Hunt** (web + GraphQL API), comprising:
1. A 1-page **test strategy** (sole-QA, risk-based).
2. A documented **exploratory + security assessment** (real bugs, severities, repro).
3. Two runnable, CI-ready **automated suites** — Playwright E2E (5–8) and Bun+GraphQL API (5–8) — typed, isolated, no flaky waits.

**Definition of Done:** both suites green in CI (chromium headless + secret-gated API), findings triaged with severity, README lets a reviewer set up and run everything in <5 min, every architectural decision justified.

---

## Phase 0 — Project scaffold  `[infra]`

- [ ] **T0.1** `bun init`; set up `package.json` (scripts from PLAN §2), `tsconfig.json` (strict).
- [ ] **T0.2** Add deps: `@playwright/test`, `typescript`, `@types/bun`. (No GraphQL lib — zero-dep `fetch`.)
- [ ] **T0.3** Create `bunfig.toml` with `[test] root = "tests/api"` (isolate Bun runner from Playwright specs).
- [ ] **T0.4** Create `playwright.config.ts` (testDir `tests/e2e`, baseURL, trace on-first-retry, CI retries, chromium project, html+list reporters).
- [ ] **T0.5** `.env.example` (`PH_API_TOKEN`, `PH_API_URL`) + `.gitignore` (`node_modules`, `.env`, `.playwright-mcp/`, `playwright-report/`, `test-results/`).
- [ ] **T0.6** Folder skeleton: `src/lib`, `tests/api`, `tests/e2e/pages`, `docs`, `.github/workflows`.
- [ ] **T0.7** One trivial green test per suite to prove the runtime split works (`bun test tests/api` + `bun run test:e2e`).

## Phase 1 — API harness & types  `[api]`

- [ ] **T1.1** `src/lib/types.ts` — `Post`, `PostEdge`, `PageInfo`, `GraphQLError` (PH's `{error, error_description}` shape), `GraphQLResponse<T>`.
- [ ] **T1.2** `src/lib/queries.ts` — named query strings (`POSTS`, `POST_BY_ID`, `INVALID_FIELD`, `TOPICS`).
- [ ] **T1.3** `src/lib/graphql-client.ts` — `gql<T>(query, variables?)` over `fetch`; injects `Authorization: Bearer` when token present; returns `{ status, data, errors }`.
- [ ] **T1.4** Token guard helper — `hasToken()` to drive `test.skipIf` for authed tests.

## Phase 2 — API tests (Part 3b)  `[api]`  → see test-cases.md API-001..008

- [ ] **T2.1** `tests/api/auth.test.ts` — API-001, API-002 (no token / invalid token → 401 contract).
- [ ] **T2.2** `tests/api/posts.test.ts` — API-003, API-006 (posts shape; single post + unknown id).
- [ ] **T2.3** `tests/api/pagination.test.ts` — API-004 (cursor walk, disjoint pages).
- [ ] **T2.4** `tests/api/validation.test.ts` — API-005, API-007, API-008 (invalid field; rate-limit headers; topics contract).
- [ ] **T2.5** Run `bun test tests/api` with a real token; confirm pass/skip behaviour.

## Phase 3 — E2E harness  `[e2e]`

- [ ] **T3.1** `tests/e2e/pages/home.page.ts` — header nav, search trigger, feed locators.
- [ ] **T3.2** `tests/e2e/pages/search.page.ts` — modal input, results, pagination.
- [ ] **T3.3** `tests/e2e/fixtures.ts` — shared helpers (console-error collector, etc.).

## Phase 4 — E2E tests (Part 3a)  `[e2e]`  → see test-cases.md E2E-001..008

- [ ] **T4.1** `home.spec.ts` — E2E-001 (home/feed), E2E-007 (console-health bug-guard).
- [ ] **T4.2** `navigation.spec.ts` — E2E-002 (main nav routing).
- [ ] **T4.3** `search.spec.ts` — E2E-003 (modal search), E2E-004 (direct + empty), E2E-005 (pagination).
- [ ] **T4.4** `product.spec.ts` — E2E-006 (product detail).
- [ ] **T4.5** (optional) `home.spec.ts` mobile project — E2E-008 (responsive smoke).
- [ ] **T4.6** Run headless locally; confirm green (E2E-007 expected-fail documented).

## Phase 5 — Documentation  `[docs]`

- [ ] **T5.1** `docs/test-strategy.md` (≤1 page, PLAN §3 outline).
- [ ] **T5.2** `docs/findings.md` — write up all observed findings (PLAN §4) + token-gated results, each with severity + repro.
- [ ] **T5.3** `docs/test-cases.md` — finalize/sync with implemented tests.
- [ ] **T5.4** `README.md` — overview, setup, run commands (highlight Bun/Node split), findings summary, decisions table, future work.

## Phase 6 — CI & finalize  `[infra]`

- [ ] **T6.1** `.github/workflows/ci.yml` — `api` job (bun) + `e2e` job (node/playwright, cached browsers, artifact upload).
- [ ] **T6.2** Add `PH_API_TOKEN` repo secret; confirm authed tests run in CI and skip on forks.
- [ ] **T6.3** Full green run on a PR; attach report artifact.
- [ ] **T6.4** Final repo review: structure, no secrets committed, remove `PLAN.md`/`TASKS.md` if desired, make repo public.

---

## Traceability (test ↔ finding)

| Test | Validates finding |
|---|---|
| API-001/002 | F1 — non-standard GraphQL 401 error contract |
| E2E-007 | F2 — manifest.json 403 / F3 — FedCM console error |
| E2E-001/003 | F4 (promoted labels), F5 (duplicate cards) surfaced during exploration |
| E2E-003/004 | F6 — search results are buttons not links (a11y/SEO) |
| API-005 | error verbosity / validation behaviour |

## Risks / watch-items

- Live external site → guard against data coupling (assert structure only).
- Playwright **must not** run under Bun runtime (use `bun run test:e2e`).
- Rate limits (fair-use) → small `first:` values, no aggressive polling.
- Forked-PR CI has no secret → authed API tests must skip cleanly.
