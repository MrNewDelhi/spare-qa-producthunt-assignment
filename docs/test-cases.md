# Test Cases — Product Hunt

Derived from live recon (2026-06-26). All E2E cases assert **structure/roles**, never volatile product data. All API cases are **read-only** (no mutations).

**Legend** — Priority: P0 (critical) · P1 (high) · P2 (medium). Type: Functional / Contract / Security / A11y / Resilience.

---

## E2E Test Cases (Playwright, web app)

Base URL: `https://www.producthunt.com`

### E2E-001 — Home page loads and feed renders
- **Priority:** P0 · **Type:** Functional · **Spec:** `home.spec.ts`
- **Preconditions:** None (anonymous).
- **Steps:**
  1. `goto('/')`.
  2. Locate `getByRole('heading', { name: 'Top Products Launching Today', level: 1 })`.
  3. Count `a[href^="/products/"]`.
- **Expected:** H1 visible; product-link count > 0; page title contains "Product Hunt".

### E2E-002 — Main navigation routes correctly
- **Priority:** P1 · **Type:** Functional · **Spec:** `navigation.spec.ts`
- **Preconditions:** On `/`.
- **Steps (data-driven per link):** Within `getByRole('navigation', { name: 'Main Navigation' })`, click each link.
- **Expected:**
  | Link | URL contains |
  |---|---|
  | Best Products | `/categories` |
  | Launches | `/leaderboard/daily/` |
  | News | `/newsletters` |
  | Forums | `/forums` |
- Target page renders its landmark/heading (no 404).

### E2E-003 — Search via header modal returns results
- **Priority:** P0 · **Type:** Functional · **Spec:** `search.spec.ts`
- **Preconditions:** On `/`.
- **Steps:**
  1. Click `[data-test="header-search-input"]` (readonly trigger).
  2. In modal, fill `getByRole('textbox', { name: /Search for products/ })` with `"notion"`.
  3. Submit (Enter) / follow to results.
- **Expected:** URL matches `**/search?q=notion`; at least one result item visible.
- **Note:** documents F6 — results are `<button>` not `<a>`.

### E2E-004 — Direct search URL + empty-results state
- **Priority:** P1 · **Type:** Functional · **Spec:** `search.spec.ts`
- **Steps:**
  1. `goto('/search?q=notion')` → assert result count > 0; search box prefilled with "notion".
  2. `goto('/search?q=zzqxnonexistentterm123')` → assert empty/no-results state (no result items).
- **Expected:** Populated results in case 1; graceful empty state in case 2 (no crash, no error page).

### E2E-005 — Search pagination controls
- **Priority:** P2 · **Type:** Functional · **Spec:** `search.spec.ts`
- **Preconditions:** `goto('/search?q=notion')`.
- **Steps:**
  1. Assert `First` and `Previous` buttons are **disabled**.
  2. Click `Next`.
- **Expected:** URL becomes `…?q=notion&page=2`; `Previous` becomes enabled; results update.

### E2E-006 — Product detail page renders
- **Priority:** P0 · **Type:** Functional · **Spec:** `product.spec.ts`
- **Preconditions:** On `/`.
- **Steps:**
  1. Read `href` of first `a[href^="/products/"]`.
  2. `goto` that href.
- **Expected:** Product name heading visible; tagline/description present; URL matches `/products/<slug>`.

### E2E-007 — Home page console health (bug-guard)
- **Priority:** P1 · **Type:** Resilience · **Spec:** `home.spec.ts`
- **Steps:**
  1. Register `page.on('console')` (filter `error`) and `page.on('pageerror')`.
  2. `goto('/')` and wait for `load`.
  3. Assert collected errors array is empty.
- **Expected (ideal):** no console errors.
- **Actual today:** **FAILS** — `manifest.json` 403 (F2) + FedCM/GSI NetworkError (F3). Kept as a documented known-defect guard, not masked.

### E2E-009 — Out-of-range search pagination must not 500  🐞 *(bug found)*
- **Priority:** P1 · **Type:** Functional / Resilience · **Spec:** `search.spec.ts`
- **Preconditions:** None.
- **Steps:**
  1. `goto('/search?q=notion&page=10000')` (and `&page=999999`).
- **Expected:** Graceful empty-state **or** 404 (consistent with invalid product slugs, which correctly 404).
- **Actual (BUG):** Renders the **HTTP 500 "Oops, something went wrong on our end"** page.
- **Characterisation:** `page=-1`, `page=abc`, `page=375` are tolerated (load normally); large values (`≥ ~10000`, incl. `999999`) → **500**. The results UI also advertises a "Last" link (e.g. `page=374` for "notion") whose upper range the backend cannot reliably serve.
- **Impact:** Unhandled server error trivially triggerable via URL; inconsistent error handling (slug→404, big page→500); poor UX + noisy 5xx in monitoring.
- **Note:** This test is expected to **fail today** — kept as a documented defect guard, like E2E-007.

### E2E-008 — Responsive smoke (mobile viewport) *(optional)*
- **Priority:** P2 · **Type:** Functional · **Spec:** `home.spec.ts` (mobile project)
- **Preconditions:** `Pixel 5`/`iPhone` device project.
- **Steps:** `goto('/')`; verify header logo + at least one product card render.
- **Expected:** Core layout renders without horizontal overflow/broken header.

### E2E-010 — Sponsor inquiry rejects unsafe company website schemes 🐞 *(bug found)*
- **Priority:** P1 · **Type:** Security / Validation · **Spec:** `public-pages.spec.ts`
- **Preconditions:** Anonymous user.
- **Steps:**
  1. `goto('/sponsor/inquiry')`, click `Get started`.
  2. Fill valid name/email/company.
  3. Fill Company website with `javascript:alert(1)`.
  4. Click `Continue`.
- **Expected:** Stay on step 1 with a clear URL validation error; only `https:` or approved schemes accepted.
- **Actual (BUG):** The form advances to `STEP 2 OF 4 - LAUNCH`.
- **Impact:** Unsafe URL can enter advertiser lead data and later reach CRM/admin/email/export surfaces.

### E2E-011 — Sponsor inquiry exposes semantic validation errors 🐞 *(bug found)*
- **Priority:** P2 · **Type:** A11y / Validation · **Spec:** `public-pages.spec.ts`
- **Steps:** `goto('/sponsor/inquiry')`, click `Get started`, click `Continue` with empty required fields.
- **Expected:** Invalid controls expose `aria-invalid` and/or associated `[role="alert"]` messages.
- **Actual (BUG):** Errors are visible text only; inspected fields had no `required`, no `aria-invalid`, and no alert role.

### E2E-012 — Newsletter signup uses email input semantics 🐞 *(bug found)*
- **Priority:** P2 · **Type:** A11y / Validation · **Spec:** `public-pages.spec.ts`
- **Steps:** `goto('/newsletters')`, inspect the signup email input, enter `<img src=x onerror=alert(1)>`, submit.
- **Expected:** Input is `type="email"`; invalid state is announced semantically. Payload is never reflected unsafely.
- **Actual (BUG):** Payload was not reflected, but the field is `type="text"` and invalid state has no alert/`aria-invalid` semantics.

### E2E-013 — Authenticated comment composer semantics *(manual / gated)*
- **Priority:** P2 · **Type:** A11y / Form safety · **Spec:** manual until a disposable account/staging environment is available.
- **Preconditions:** Signed-in account.
- **Steps:** Open a forum thread, inspect the top-level comment composer.
- **Expected:** Editor textbox has an accessible label; toolbar controls are named `type="button"` controls; only the final `Comment` action submits.
- **Actual (BUG):** Authenticated inspection found an unlabeled `contenteditable` textbox and multiple unnamed icon buttons that default to submit-like controls inside the form.
- **Safety note:** Publishing a malicious-comment payload is intentionally not automated against production. Run sanitization publishing only with explicit approval and a disposable/staging account.

### E2E-014 — Signed-in header notification link is named 🐞 *(bug found)*
- **Priority:** P2 · **Type:** A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Sign in, open `/categories`, inspect the `/notifications` header link.
- **Expected:** Icon-only notification link has accessible name `Notifications`.
- **Actual (BUG):** Link is visible but unnamed.

### E2E-015 — Public pages do not reuse duplicate IDs 🐞 *(bug found)*
- **Priority:** P2 · **Type:** DOM / A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Inspect IDs on `/categories`, `/topics`, and `/topics/artificial-intelligence`.
- **Expected:** No duplicate IDs in the rendered DOM.
- **Actual (BUG):** Shared SVG IDs repeat.

### E2E-016 — Topic controls are labeled 🐞 *(bug found)*
- **Priority:** P2 · **Type:** A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/topics` and topic detail pages; inspect radio/action controls.
- **Expected:** Radio groups and icon-only product actions have programmatic names.
- **Actual (BUG):** Unlabeled 1-5 radios and unnamed product action buttons.

### E2E-017 — Forum category pages expose H1/canonical structure 🐞 *(bug found)*
- **Priority:** P2 · **Type:** SEO / A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/p/general` and `/p/ai`.
- **Expected:** One H1 and a self-canonical URL.
- **Actual (BUG):** Both pages have zero H1s; `/p/ai` lacks canonical.

### E2E-018 — Leaderboard base routes resolve 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Functional / SEO · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/leaderboard/weekly` and `/leaderboard/monthly`.
- **Expected:** Valid leaderboard page or redirect to a dated leaderboard.
- **Actual (BUG):** Both render self-canonical 404 pages.

### E2E-019 — Products listing links are named 🐞 *(bug found)*
- **Priority:** P2 · **Type:** A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/products`; inspect product logo and review links.
- **Expected:** Product image links and review links have meaningful names.
- **Actual (BUG):** Repeated core listing links are unnamed.

### E2E-020 — Leaderboard route variants recover/canonicalize 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Functional / SEO · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/leaderboard`, `/leaderboard/daily/2026/06/26`, `/leaderboard/yearly`, and `/leaderboard/all-time`.
- **Expected:** H1 on archive page, canonical redirect for date shape, and valid mode routes.
- **Actual (BUG):** Missing H1, duplicate date URL, and 404 mode routes.

### E2E-021 — Category aliases and category action buttons work semantically 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Functional / A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Open common aliases such as `/categories/marketing`; inspect category detail action buttons.
- **Expected:** Aliases recover; action buttons are named.
- **Actual (BUG):** Some aliases 404; category detail product actions are unnamed.

### E2E-022 — Product subpages expose named controls 🐞 *(bug found)*
- **Priority:** P2 · **Type:** A11y · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/products/chatgpt/alternatives` and inspect logo links/action buttons.
- **Expected:** Product logo links and actions have accessible names.
- **Actual (BUG):** Alternatives and other product subpages expose unnamed controls.

### E2E-023 — Search and creation routes expose valid semantics 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Form / SEO / Functional · **Spec:** `public-pages.spec.ts`
- **Steps:** Open `/search`, invalid search page values, `/posts/new`, `/p/new`, and common creation/docs routes.
- **Expected:** H1s, normalized pagination, URL input semantics, named editor controls, and route recovery.
- **Actual (BUG):** Missing H1s, invalid page params retained, `type=text` URL field, unlabeled thread editor, and several common routes 404.

---

## API Test Cases (Bun + typed fetch, GraphQL)

Endpoint: `https://api.producthunt.com/v2/api/graphql` · Auth: `Authorization: Bearer ${PH_API_TOKEN}`

### API-001 — Request without token is rejected
- **Priority:** P0 · **Type:** Security/Contract · **File:** `auth.test.ts` · **No token needed.**
- **Steps:** POST `{ posts(first:1){ edges{ node{ id name } } } }` with **no** Authorization header.
- **Expected:** HTTP **401**; body `{ data: null, errors: [{ error: "invalid_oauth_token", error_description: <string> }] }`.
- **Validates:** F1 (non-spec error contract; documents 401 vs spec's 200).

### API-002 — Invalid token rejected identically
- **Priority:** P1 · **Type:** Security/Contract · **File:** `auth.test.ts` · **No token needed.**
- **Steps:** Same query with `Authorization: Bearer invalid_token_123`.
- **Expected:** HTTP 401; identical error shape to API-001 (no differentiation between missing vs invalid).

### API-003 — `posts` query returns typed connection
- **Priority:** P0 · **Type:** Contract · **File:** `posts.test.ts` · **Token required (skip if absent).**
- **Steps:** Query `posts(first: 5){ edges { node { id name votesCount } } pageInfo { endCursor hasNextPage } }`.
- **Expected:** HTTP 200; `errors` undefined; `edges.length === 5`; each node has string `id`, string `name`, number `votesCount`; `pageInfo.endCursor` is string; `hasNextPage` boolean.

### API-004 — Cursor pagination returns distinct pages
- **Priority:** P1 · **Type:** Functional · **File:** `pagination.test.ts` · **Token required.**
- **Steps:**
  1. Fetch page 1: `posts(first: 5)` → capture node ids + `endCursor`.
  2. Fetch page 2: `posts(first: 5, after: <endCursor>)`.
- **Expected:** Both succeed; page-2 ids are **disjoint** from page-1 ids.

### API-005 — Invalid field returns validation error (not 500)
- **Priority:** P1 · **Type:** Contract · **File:** `validation.test.ts` · **Token required.**
- **Steps:** Query `posts(first:1){ edges { node { id notARealField } } }`.
- **Expected:** GraphQL validation error returned (`errors` populated); HTTP not 5xx; no internal stack-trace leakage in message.

### API-006 — Single post by id; unknown id handled
- **Priority:** P1 · **Type:** Functional · **File:** `posts.test.ts` · **Token required.**
- **Steps:**
  1. Take a valid id from API-003; query `post(id: <id>){ id name tagline }`.
  2. Query `post(id: "0")` (non-existent).
- **Expected:** Case 1 returns typed post. Case 2 returns a graceful error / null (no crash, structured `errors`).

### API-007 — Rate-limit / complexity headers present
- **Priority:** P2 · **Type:** Resilience · **File:** `validation.test.ts` · **Token required.**
- **Steps:** Send a simple authed query; inspect response headers.
- **Expected:** Rate-limit/complexity headers present (e.g. `X-Rate-Limit-*`); a 429 is tolerated and asserted-on rather than failing the suite.

### API-008 — `topics` query contract *(optional)*
- **Priority:** P2 · **Type:** Contract · **File:** `validation.test.ts` · **Token required.**
- **Steps:** Query `topics(first: 3){ edges { node { id name } } }`.
- **Expected:** HTTP 200; typed list of 3 topics with string `id`/`name`.

### API-009 — `posts(order: VOTES)` ordering is correct
- **Priority:** P1 · **Type:** Functional · **File:** `posts.test.ts` · **Token required.**
- **Steps:** Query `posts(first: 10, order: VOTES){ edges { node { id votesCount } } }`.
- **Expected:** HTTP 200; `votesCount` values are **monotonically non-increasing** across the returned list.

### API-010 — `post(id)` and `post(slug)` parity
- **Priority:** P1 · **Type:** Contract · **File:** `posts.test.ts` · **Token required.**
- **Steps:**
  1. From API-003 take a node's `id` and `slug`.
  2. Query `post(id: <id>){ id slug name }` and `post(slug: <slug>){ id slug name }`.
- **Expected:** Both return the **same** `id`/`name`. Edge: `post` with **neither** arg → graceful error (not 500); both args → consistent precedence (documented).

### API-011 — Viewer-context fields with a developer token
- **Priority:** P2 · **Type:** Security/Contract · **File:** `security.test.ts` · **Token required.**
- **Steps:** Query `posts(first:1){ edges { node { id isVoted isCollected } } }` and `viewer { user { id } }`.
- **Expected:** `isVoted`/`isCollected` are booleans (likely `false` for a non-user token); `viewer` behaviour documented (data for a user token, null/error for client-only). Confirms no other user's state leaks.

### API-012 — Rate-limit headers decrement under load
- **Priority:** P2 · **Type:** Resilience · **File:** `security.test.ts` · **Token required.**
- **Steps:** Send a moderately nested query (e.g. `posts(first:5){ edges { node { id comments(first:2){ edges { node { id } } } } } }`); read `x-rate-limit-remaining` before/after a second call. *(Controlled — no DoS.)*
- **Expected:** `x-rate-limit-limit/remaining/reset` present and numeric; `remaining` is lower on the second call (complexity accounting works).

### API-013 — Non-string `query` values are client errors 🐞 *(bug found)*
- **Priority:** P1 · **Type:** Contract / Resilience · **File:** `contract-edge.test.ts` · **Token required.**
- **Steps:** POST JSON with `query` as number, boolean, object, and array.
- **Expected:** HTTP 4xx JSON validation error.
- **Actual (BUG):** HTTP 500 `SERVER_ERROR`.

### API-014 — Non-object `variables` values are client errors 🐞 *(bug found)*
- **Priority:** P1 · **Type:** Contract / Resilience · **File:** `contract-edge.test.ts` · **Token required.**
- **Steps:** POST a variable query with `variables` as array or number.
- **Expected:** HTTP 4xx validation error.
- **Actual (BUG):** HTTP 500 `SERVER_ERROR`.

### API-015 — Unknown `operationName` fails closed 🐞 *(bug found)*
- **Priority:** P1 · **Type:** Contract / Safety · **File:** `contract-edge.test.ts` · **Token required.**
- **Steps:** Send a single-operation document named `A` with `operationName: "B"`.
- **Expected:** Unknown operation error; no data.
- **Actual (BUG):** Operation `A` executes.

### API-016 — Malformed JSON returns JSON error envelope 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Contract · **File:** `contract-edge.test.ts` · **Token required.**
- **Steps:** POST `Content-Type: application/json` with malformed body.
- **Expected:** JSON parser error envelope.
- **Actual (BUG):** Empty HTML 400.

### API-017 — CORS authorization posture is explicit/restricted 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Security / Contract · **File:** `contract-edge.test.ts` · **Token required.**
- **Steps:** Preflight with arbitrary `Origin` and requested `authorization,content-type`.
- **Expected:** Restricted origin or documented intentional public-token posture.
- **Actual (BUG/Candidate):** `access-control-allow-origin: *` with Authorization allowed.

### API-018 — Advertised HEAD method is supported 🐞 *(bug found)*
- **Priority:** P2 · **Type:** Contract · **File:** `contract-edge.test.ts` · **Token required.**
- **Steps:** Send authenticated `HEAD /v2/api/graphql`.
- **Expected:** Supported response or method not advertised.
- **Actual (BUG):** HTML 404 while OPTIONS advertises `HEAD`.

---

## Coverage summary

| Area | E2E | API |
|---|---|---|
| Auth / security | — | API-001, 002, 011 |
| Core read flow | E2E-001, 003, 004, 006 | API-003, 006, 010 |
| Navigation | E2E-002 | — |
| Pagination | E2E-005, 009 | API-004 |
| Ordering / contract / validation | E2E-020...023 | API-005, 008, 009, 013...018 |
| Resilience / observability | E2E-007, 009 | API-007, 012, 013, 014 |
| Responsive / a11y | E2E-008, E2E-010...023 | — |

**Totals:** 23 documented E2E cases · 18 documented API cases. Automated Playwright currently lists 40 E2E tests; API edge tests are token-gated where required.

## Known-defect guard tests (expected to fail today)
- **E2E-007** — home console errors (manifest 403 / FedCM).
- **E2E-009** — out-of-range search pagination returns 500.
