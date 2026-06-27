claude --resume 60120220-6c2c-4622-bfa8-234ca04da58c

# Spare QA Engineering Assignment — Detailed Plan

**Target under test:** Product Hunt (web app + public GraphQL API), treated as a product we own.
**Effort target:** ~4–6 focused hours. Optimise for clear thinking and a clean, runnable repo over breadth.
**Deliverable:** public GitHub repo + README, covering 3 parts (Strategy, Exploratory/Security, Automated Tests).

---

## 0. Key decisions (and why)

| Decision | Choice | Why |
|---|---|---|
| Runtime / pkg manager | **Bun** for install + API test runner (`bun test`) | Mandated by brief; Bun's native test runner is fast and TS-native. |
| E2E execution | **Playwright CLI under Node**, invoked via `bun run test:e2e` | Playwright is **not supported on the Bun runtime** — Chromium launch hangs ([bun#23826](https://github.com/oven-sh/bun/issues/23826), [playwright#27139](https://github.com/microsoft/playwright/issues/27139)). The `playwright` bin has a `#!/usr/bin/env node` shebang, so `bun run <script>` executes it under Node. **Never** run specs with `bun test`. |
| Runner separation | `bun test` globs **`tests/api/**`** only; Playwright `testDir: tests/e2e` | Prevents Bun's runner from trying to execute Playwright specs (incompatible `test`/`expect`). |
| API HTTP client | Thin typed **`fetch`** wrapper (zero-dep) | Brief says "any TS HTTP library"; keeps deps minimal and keeps API tests on `bun test` (Playwright's `APIRequestContext` would force Node, violating "API: TS + Bun"). |
| Token handling | Read `PH_API_TOKEN` from env; **skip API suite gracefully if absent** | Reviewers without a token still get green CI; secret-driven full run in CI. |
| E2E assertion style | Assert on **structure/roles/`data-test`**, never volatile product names | PH is a live, third-party, data-changing site; Playwright best-practice warns against asserting on uncontrolled external data. Frame as monitoring-style E2E. |
| Browsers in CI | **chromium only**, `--with-deps` | Fast, cost-effective; cross-browser noted as future work. |
| Flakiness policy | web-first auto-retrying assertions, no `waitForTimeout`, `retries: 2` on CI, `trace: 'on-first-retry'` | Brief: "no flaky waits". |

---

## 1. Repository structure

```
spare-qa-assignment/
├── README.md                     # setup, run, findings summary, decisions, future work
├── PLAN.md                       # this file (can be removed before submit)
├── package.json                  # scripts + deps
├── tsconfig.json                 # strict TS
├── playwright.config.ts          # E2E config (Node)
├── bunfig.toml                   # bun test config (scopes test root to tests/api)
├── .env.example                  # PH_API_TOKEN=
├── .gitignore                    # node_modules, .env, .playwright-mcp/, playwright-report/, test-results/
├── .github/
│   └── workflows/
│       └── ci.yml                # 2 jobs: api (bun) + e2e (node/playwright)
├── docs/
│   ├── test-strategy.md          # Part 1 (≤1 page)
│   └── findings.md               # Part 2 (bugs / inconsistencies / security)
├── src/
│   └── lib/
│       ├── graphql-client.ts     # typed fetch wrapper around the GraphQL endpoint
│       ├── queries.ts            # named GraphQL query strings
│       └── types.ts              # response interfaces (Post, PageInfo, GraphQLError…)
└── tests/
    ├── api/                      # Part 3b — bun test
    │   ├── auth.test.ts
    │   ├── posts.test.ts
    │   ├── pagination.test.ts
    │   └── validation.test.ts
    └── e2e/                      # Part 3a — playwright (node)
        ├── fixtures.ts           # shared fixtures / helpers
        ├── pages/                # light page objects
        │   ├── home.page.ts
        │   └── search.page.ts
        ├── home.spec.ts
        ├── navigation.spec.ts
        ├── search.spec.ts
        └── product.spec.ts
```

---

## 2. Tooling & config

**`package.json` scripts**
```jsonc
{
  "scripts": {
    "test:api": "bun test tests/api",
    "test:e2e": "playwright test",          // runs under Node via bun run
    "test:e2e:ui": "playwright test --ui",
    "pw:install": "playwright install --with-deps chromium",
    "typecheck": "tsc --noEmit"
  }
}
```
Run E2E with `bun run test:e2e` (Node), API with `bun test:api` / `bun test tests/api`.

**`playwright.config.ts` essentials**
- `testDir: './tests/e2e'`
- `use.baseURL = 'https://www.producthunt.com'`
- `use.trace = 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`
- `retries: process.env.CI ? 2 : 0`, `forbidOnly: !!process.env.CI`
- `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]` (+ optional mobile project for the responsive spec)
- `reporter: [['html'], ['list']]`

**`bunfig.toml`**
```toml
[test]
root = "tests/api"
```

**`.env.example`**
```
PH_API_TOKEN=
PH_API_URL=https://api.producthunt.com/v2/api/graphql
```

---

## 3. Part 1 — Test Strategy (`docs/test-strategy.md`, ≤1 page)

Outline (bullets, not prose):
- **Context & risk model** — sole QA; PH is a live, external, data-changing system → risk-based, monitoring-leaning, not exhaustive.
- **Priorities (highest→lowest):**
  1. API contract & auth correctness (security-first lens to mirror Spare).
  2. Core read journeys: home feed, search, product detail, navigation.
  3. Resilience/observability: console errors, broken assets, error contracts.
- **Test pyramid:** heavy typed API checks → focused structural E2E → manual exploratory; minimal but real.
- **Test data & environments:** read-only public API → **no mutations, no teardown**; avoids ethical/data-integrity risk.
- **CI gating:** PR-blocking; chromium headless; secret-driven API run; artifacts (traces/HTML report).
- **Flakiness policy:** web-first assertions, no hard waits, assert structure not volatile data, retries+trace on CI.
- **Security posture:** authz/scopes, error verbosity/info leakage, introspection, rate-limit behaviour — all within ethical bounds (no exploitation/DoS).
- **Explicitly out of scope (+ why):** authenticated/write flows (needs prod creds, mutates real data), cross-browser matrix, load/perf, visual regression — listed as future work.
- **What "done"/quality means here:** green CI on both suites, findings triaged with severity, repeatable setup.

---

## 4. Part 2 — Exploratory Testing & Security Assessment (`docs/findings.md`)

Format per finding: **Title · Severity · Area · Steps to reproduce · Expected vs Actual · Evidence · Notes**.

**Already observed during recon (seed the doc with these):**

1. **GraphQL error contract is non-spec-compliant.** *Sev: Medium (contract/interop).*
   - Repro: `POST https://api.producthunt.com/v2/api/graphql` with no/invalid `Authorization`.
   - Actual: **HTTP 401** + `{"data":null,"errors":[{"error":"invalid_oauth_token","error_description":"…"}]}`.
   - Expected (GraphQL spec): transport `200` with `errors[].message`. PH uses OAuth-style `error`/`error_description` → standard clients (Apollo, urql) may mishandle.
   - Note: no-token and invalid-token responses are **identical** (no differentiation).

2. **Homepage `manifest.json` returns 403.** *Sev: Low.* Broken PWA manifest; console error on every load.

3. **Google FedCM / GSI `NetworkError` on home.** *Sev: Low.* Third-party identity init failing client-side; noisy console.

4. **"Promoted" label appears on essentially every product card.** *Sev: Medium (ad-disclosure correctness).* Possible over-labelling/rendering bug — investigate organic vs promoted distinction.

5. **Duplicate product cards.** *Sev: Low.* Same product (e.g. Viktor.com) repeats within and across feed sections; ad slots injected as duplicates.

6. **Search results render as `<button>`, not `<a>`.** *Sev: Medium (SEO + a11y).* Not crawlable; keyboard/AT semantics weaker than links.

7. **Search result accessible name duplicated.** *Sev: Low (a11y).* e.g. "Notion Notion The all-in-one workspace 1.4K reviews" — name announced twice.

8. **`/v4/reset` issues `Clear-Site-Data` on load.** *Sev: Info.* Cache cleared each visit — worth confirming intent/perf impact.

**Further exploration to run (with token where needed):**
- Introspection enabled in prod? (`__schema` query) — info exposure consideration.
- Rate-limit / complexity headers and 429 behaviour under fair-use.
- Scope enforcement: does a Public-scope token leak Private-only fields?
- Error verbosity on malformed queries (stack/internal leakage).
- Pagination edge cases: `first: 0`, huge `first`, invalid cursor.
- Web: 404/invalid product slug handling; empty-search state; deep pagination (`Last` = page 374 for "notion") integrity.

Mark each finding **observed live** vs **needs token to verify**.

---

## 5. Part 3a — E2E (Playwright) — `tests/e2e/`

5–8 specs, structural assertions, real routes/locators discovered in recon.

**Stable locators discovered:**
- Header search trigger (readonly): `[data-test="header-search-input"]` (click → modal).
- Search modal input: `getByRole('textbox', { name: /Search for products/ })`.
- Main nav: `getByRole('navigation', { name: 'Main Navigation' })` → links *Best Products* `/categories`, *Launches* `/leaderboard/daily/...`, *News* `/newsletters`, *Forums* `/forums*`, *Advertise* `/sponsor`.
- Home h1: `getByRole('heading', { name: 'Top Products Launching Today', level: 1 })`.
- Product cards: `page.locator('a[href^="/products/"]')`.
- Search results page is directly addressable: `/search?q=<term>`; tabs → `/search`, `/search/launches`, `/search/users`.

**Scenarios:**
1. **home.spec** — home loads; h1 visible; `a[href^="/products/"]` count > 0 (feed renders, no data coupling).
2. **navigation.spec** — each main-nav link routes to expected path (assert `page.url()` / landmark on target).
3. **search.spec (modal)** — click trigger → type in modal input → assert URL matches `**/search?q=` and ≥1 result button.
4. **search.spec (direct + empty)** — `goto('/search?q=notion')` → results > 0; `goto('/search?q=<gibberish>')` → empty-state assertion.
5. **search.spec (pagination)** — on `/search?q=notion`: First/Previous **disabled**; click Next → URL `?page=2`.
6. **product.spec** — read first card's href, `goto` it, assert product name heading + tagline present.
7. **home.spec (console-health, bug-guard)** — collect `page.on('console','pageerror')`; assert none. **Expected to fail today** (manifest 403) → documented known defect, not masked.
8. **(optional) responsive smoke** — mobile viewport project: header + feed render.

**Conventions:** light page objects (`home.page.ts`, `search.page.ts`); role/`data-test` locators; web-first assertions (`toBeVisible`, `toHaveURL`); zero `waitForTimeout`.

---

## 6. Part 3b — API (Bun + typed fetch) — `tests/api/`

`src/lib/graphql-client.ts`: `async function gql<T>(query, variables?)` → POSTs to `PH_API_URL`, sets `Authorization: Bearer ${PH_API_TOKEN}` when present, returns typed `{ data, errors, status }`. Suite-level guard: if no token, `test.skip` the authenticated tests (auth-failure tests still run since they need no token).

5–8 tests:
1. **auth.test** — no token → `status === 401`, `errors[0].error === 'invalid_oauth_token'` (asserts the real non-standard contract).
2. **auth.test** — invalid token → identical 401 contract (documents non-differentiation).
3. **posts.test** — authed `posts(first: 5)` → typed `edges[].node { id name votesCount }` + `pageInfo { endCursor hasNextPage }` present and well-typed.
4. **pagination.test** — fetch page 1, then `posts(first:5, after: endCursor)` → node id sets are disjoint.
5. **validation.test** — query a non-existent field → GraphQL validation error shape returned (no 500).
6. **posts.test** — single `post(id: …)` typed; unknown id → graceful error not crash.
7. **(if token) ratelimit.test** — assert presence of rate-limit/complexity headers; tolerate 429.
8. **(optional) topics.test** — `topics`/`collection` query contract.

**Conventions:** typed responses via `src/lib/types.ts`; no shared mutable state; **no mutations**; each test self-contained.

---

## 7. CI — `.github/workflows/ci.yml`

Two jobs, run on PR + push:

- **api** — `oven-sh/setup-bun` → `bun install` → `bun run typecheck` → `bun test tests/api`. `PH_API_TOKEN` from `secrets`; authed tests skip if secret unset (fork PRs).
- **e2e** — `oven-sh/setup-bun` → `bun install` → cache `~/.cache/ms-playwright` → `bun run pw:install` → `bun run test:e2e`. Upload `playwright-report/` + traces as artifacts on failure.

Notes: Linux runners; chromium only; `CI=true` triggers retries + `forbidOnly`.

---

## 8. README outline

- **Overview** — what this is, target, the 3 parts.
- **Setup** — install Bun, `bun install`, `cp .env.example .env`, add token, `bun run pw:install`.
- **Running** — `bun test tests/api` (API), `bun run test:e2e` (E2E), `bun run test:e2e:ui`, `bun run typecheck`. **Call out the Bun-vs-Playwright runtime split explicitly.**
- **Findings summary** — top items from `docs/findings.md` with severity; link to full doc.
- **Architecture decisions** — table from §0 (runtime split, fetch wrapper, skip-on-no-token, structural locators, monitoring posture).
- **What I'd do with more time** — authenticated/write flows in a sandbox, contract testing + GraphQL codegen, cross-browser + visual regression, perf/load, axe a11y sweep, synthetic monitoring + alerting, deeper security (introspection/scope fuzzing).

---

## 9. Suggested build order (time-boxed)

1. **(45m)** Scaffold: `bun init`, deps, tsconfig, configs, `.gitignore`, one trivial green test in each suite + CI skeleton.
2. **(60m)** API: client wrapper + types + 5–6 tests; verify against live API with a token.
3. **(75m)** E2E: page objects + 6–7 specs; confirm headless green locally.
4. **(45m)** Exploratory pass → flesh out `findings.md` (verify the recon findings + run token-gated checks).
5. **(40m)** Strategy doc.
6. **(35m)** README + CI polish + final green run.

---

## 10. Ethical guardrails

- Read-only only: **no mutations, no spam votes/comments, no auth brute-force, no DoS/load testing** against PH.
- Security observations from normal API/web responses and public introspection only — **observe, document, don't exploit**.
- Respect fair-use rate limits; small `first:` values; no aggressive crawling.
```

