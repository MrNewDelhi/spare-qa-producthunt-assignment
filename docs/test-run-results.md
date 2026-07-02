# Test Run Results

Run date: 2026-07-02

## Environment

- Playwright: `1.61.1`
- Bun: `1.3.14`
- Product Hunt web base URL: `https://www.producthunt.com`
- Product Hunt API URL: `https://api.producthunt.com/v2/api/graphql`

## Commands Run

```bash
bun run typecheck
bunx playwright test --project=chromium --grep @core --list
PW_HEADLESS=0 bunx playwright test --project=chromium --grep @core
bun run test:e2e:record   # headed run that records a trace + video per scenario
bun test tests/api/core.test.ts
bun test tests/api
```

## Results

| Area | Result |
|---|---|
| TypeScript (`bun run typecheck`) | Passed |
| Playwright discovery | 64 total E2E tests (32 on Chromium) |
| Default E2E suite (`test:e2e`) | Exactly 8 `@core` Chromium scenarios in 6 files |
| Default E2E execution (headed, local) | No failures. Passes the Cloudflare challenge and runs real assertions; navigations that hit a `403` skip-with-reason |
| Default API suite (`test:api`, with token) | **6 pass / 0 fail** (includes 1 `failing` defect-guard) |
| Extended API suite (`test:api:extended`, fresh window) | 28 tests: 22 pass (incl. runtime Zod schema-contract) + 6 `failing` defect-guards; subject to API rate limits if re-run rapidly |

## E2E Execution Evidence

Headed local Chromium passes Cloudflare and renders the app. In a representative
`PW_HEADLESS=0 bunx playwright test --project=chromium --grep @core` run:

- Home, auth modal, search (direct + pagination) and the daily leaderboard
  scenarios passed against live Product Hunt.
- The leaderboard `Launch Archive` assertion is scoped to `<main>` to avoid the
  header-nav "Launch archive" link (previously a strict-mode violation).
- Navigations that received a Cloudflare `403` were skipped with an explicit
  reason rather than failing red. Skips are intermittent and environmental.

Headless (CI default) is `403`-gated by Cloudflare; the `BasePage` guard turns
that into a skip-with-reason instead of a misleading failure. No sleeps, no
`networkidle`, no bypass logic.

## Reports & Execution Video

`bun run test:e2e:record` runs the core suite headed with `PW_VIDEO=1`, which
records a trace and a video for every scenario. The last run produced:

- `playwright-report/` — the self-contained HTML report (open with `bun run report`),
  with each scenario's steps, screenshots, trace, and video attached.
- `test-results/**/video.webm` — one execution video per scenario.
- `test-results/**/trace.zip` — a Playwright trace per scenario (view at
  [trace.playwright.dev](https://trace.playwright.dev) or `bunx playwright show-trace <file>`).

These artifacts are build output, so they are git-ignored rather than committed;
regenerate them locally with the command above.

## API Defect Guards (`test.failing`)

Several API contracts the live endpoint currently violates are encoded as
`tokenTest.failing` so the suite stays green while documenting the defect and
flips red the moment Product Hunt fixes the behaviour:

- Non-string `query` / non-object `variables` return `500` instead of a `4xx`.
- Unknown `operationName` still executes / does not error as expected.
- Malformed JSON does not return a clean JSON `400` envelope.
- Permissive CORS / `HEAD` handling on the GraphQL endpoint.

See `docs/findings.md` for the full write-ups.

## API Rate Limits

The token enforces a 15-minute, complexity-based budget surfaced via
`x-rate-limit-limit`, `x-rate-limit-remaining`, and `x-rate-limit-reset`. The
core suite stays under budget. Running the heavier extended suite repeatedly in
a short window drives `remaining` negative and returns `429` until the reset
window elapses — run it once per window.

## What Requires Trusted Access

- Headless frontend execution requires a context Product Hunt allows through
  Cloudflare (run headed locally, or use a staging/allowlisted environment).
- Token-gated API tests require `PH_API_TOKEN`. Without it they `skip`, never
  fake-pass; CI asserts the token is present (`tests/api/preflight.test.ts`).
