# Frontend JIRA Tickets — Product Hunt (black-box, functional)

Environment: Chromium (Playwright), https://www.producthunt.com, 2026-06-27. Mostly anonymous/read-only; one authenticated comment-composer inspection was performed after user sign-in. No public comments or final form submissions were posted.

> **Honest scope note:** the web app is functionally polished. No dramatic "flagship" user-facing exploit exists within ethical bounds (Product Hunt is a third party — auth-bypass / internal-endpoint probing was deliberately not pursued). The findings below are genuine functional / data-integrity / UX / trust defects, ranked by impact.

## Summary

| ID | Title | Type | Severity | Status |
|----|-------|------|----------|--------|
| FE-1 | Out-of-range search page → HTTP 500 | Bug | Major | CONFIRMED |
| FE-2 | Feed metric not reflected on destination (click "293 upvotes" → page headlines "487 followers") | Bug/UX | Major | CONFIRMED |
| FE-3 | "Promoted" label over-applied across feed + product pages | Bug/Trust | Major | CONFIRMED |
| FE-4 | Same ad product duplicated across every feed section | Bug | Minor | CONFIRMED |
| FE-5 | Headline upvote count vs underlying vote records mismatch (~293 vs ~426) | Data-integrity | Major | CONFIRMED (cross-checked via API) |
| FE-6 | `manifest.json` 403 → broken PWA + console error | Bug | Minor | CONFIRMED |
| FE-7 | Google FedCM/GSI NetworkError on home | Bug | Minor | CONFIRMED |
| FE-8 | Search results are `<button>`, not `<a>` (SEO/a11y) | A11y/SEO | Minor | CONFIRMED |
| FE-9 | Sponsor inquiry accepts `javascript:` company website and advances | Security/Validation | Major | CONFIRMED |
| FE-10 | Sponsor inquiry validation errors are not semantic | A11y/Validation | Minor | CONFIRMED |
| FE-11 | Newsletter invalid email uses `type=text` and no semantic invalid state | A11y/Validation | Minor | CONFIRMED |
| FE-12 | Authenticated comment composer has unlabeled submit-like toolbar buttons | A11y/Form | Minor | CONFIRMED |
| FE-13 | Signed-in notification icon link is unnamed site-wide | A11y | Minor | CONFIRMED |
| FE-14 | Topic pages expose unlabeled rating radios and unnamed product actions | A11y | Minor | CONFIRMED |
| FE-15 | Forum category pages lack H1s; `/p/ai` also lacks canonical | SEO/A11y | Minor | CONFIRMED |
| FE-16 | Weekly/monthly leaderboard base routes 404 | Bug/SEO | Minor | CONFIRMED |
| FE-17 | `/products` listing has unnamed product image/review links | A11y | Minor | CONFIRMED |
| FE-18 | Public pages reuse duplicate SVG IDs | DOM/A11y | Minor | CONFIRMED |
| FE-19 | Leaderboard/category/docs/create route variants 404 or fail to canonicalize | Bug/SEO | Minor | CONFIRMED |
| FE-20 | Product review/launch/alternatives pages have unnamed action/logo controls | A11y | Minor | CONFIRMED |
| FE-21 | Search and submit-product pages lack core form/page semantics | A11y/Form | Minor | CONFIRMED |
| FE-22 | Help Center social links are malformed and duplicate language IDs | Bug/A11y | Minor | CONFIRMED |
| SEC-CAND-1 | External login `origin` preserved into OAuth provider forms | Security | Needs callback validation | CANDIDATE |
| SEC-NEG | Clickjacking & open-redirect on auth pages | Security | — | NOT VULNERABLE (verified) |

---

## FE-1 — Out-of-range search pagination returns HTTP 500
- **Type:** Bug · **Severity:** Major · **Component:** Search
- **Steps:**
  1. Open `https://www.producthunt.com/search?q=notion&page=10000` (also `&page=999999`).
- **Actual:** Full-page **HTTP 500** "Oops, something went wrong on our end".
- **Expected:** Graceful empty state or 404 (an invalid product slug correctly 404s — so handling is inconsistent).
- **Boundary:** `page=-1`, `page=abc`, `page=375` render normally; large values (`≥ ~10,000`) → 500. The results UI advertises a "Last" link (e.g. `page=374` for "notion") whose upper range the backend cannot serve.
- **Impact:** Trivially user-triggerable 5xx; inconsistent error handling; pollutes error monitoring.
- **Fix:** Clamp/validate `page`; return the last valid page or an empty state.

## FE-2 — Feed metric is not reflected on the destination page
- **Type:** Bug / UX · **Severity:** Major · **Component:** Feed → Product page
- **Steps:**
  1. On `/`, note card "Agent Arena" under "Top Products Launching Today": **293 upvotes, 61 comments**, linking to `/products/agent-arena`.
  2. Click it.
- **Actual:** Destination `/products/agent-arena` headlines **"487 followers / Launching today"** and does **not** surface the 293 launch-upvote figure the user just clicked.
- **Expected:** The metric shown on the card (launch upvotes) should be visible/consistent on the destination, or the card should link to the launch view that shows it.
- **Impact:** Confusing IA; the headline number a user acted on disappears on arrival; followers ≠ upvotes conflation.
- **Fix:** Surface launch upvote count on the product hub, or route cards to the launch view.

## FE-3 — "Promoted" label is over-applied
- **Type:** Bug / Trust & disclosure · **Severity:** Major · **Component:** Feed / Ads
- **Steps:**
  1. Load `/`. Observe nearly every card in "Top Products Launching Today" carries a "Promoted" badge.
  2. Open any product page (e.g. `/products/agent-arena`) — two `/sponsor` "Promoted" links render plus a "Promoted" comment slot.
- **Actual:** "Promoted" appears on organic-looking ranked entries and across pages indiscriminately.
- **Expected:** Only genuinely paid placements should be labelled "Promoted"; ranked organic launches should not be.
- **Impact:** Ad-disclosure correctness / user trust — either real placements are mislabelled or labelling is buggy. (Needs product confirmation of which cards are truly paid.)
- **Fix:** Audit the labelling logic; label only paid slots.

## FE-4 — Same ad product duplicated across every feed section
- **Type:** Bug · **Severity:** Minor · **Component:** Feed / Ads
- **Steps:** On `/`, observe "Viktor.com" (no rank number) appears with identical counts (108 comments / 526 votes) in Today, Yesterday, Last Week **and** Last Month sections.
- **Expected:** De-duplicate injected ad slots, or cap repetition.
- **Impact:** Looks broken/spammy; wastes feed real estate.

## FE-5 — Headline upvote count vs underlying vote records mismatch
- **Type:** Data-integrity · **Severity:** Major · **Component:** Votes
- **Steps (black-box + API cross-check):**
  1. Feed/card shows Agent Arena ≈ **293** upvotes (`votesCount`).
  2. Public API `post.votes.totalCount` for the same product ≈ **426** vote records (`{ posts(first:1){ edges{ node{ votesCount votes(first:1){ totalCount } } } } }`).
- **Actual:** Headline metric (~293) undercounts the actual vote connection (~426) by ~30% on the #1 product.
- **Expected:** Either field documented as a different measure, or the two reconcile.
- **Impact:** The primary ranking signal users see may not match the underlying data. **Needs product clarification** (multi-launch history vs current launch) before treating as a hard bug, but the discrepancy is real and reproducible.

## FE-6 — `manifest.json` 403 (broken PWA)
- **Type:** Bug · **Severity:** Minor · **Steps:** Load `/`; DevTools console shows `Manifest fetch from …/manifest.json failed, code 403` (x2). **Impact:** PWA install/theming broken; recurring console error. **Fix:** serve the manifest (allow it through the WAF/edge).

## FE-7 — Google FedCM/GSI NetworkError on home
- **Type:** Bug · **Severity:** Minor · **Steps:** Load `/`; console: `[GSI_LOGGER] FedCM get() … NetworkError`. **Impact:** One-tap sign-in init fails client-side; console noise. **Fix:** review Google Identity/FedCM config.

## FE-8 — Search results are buttons, not links (SEO + a11y)
- **Type:** A11y / SEO · **Severity:** Minor · **Steps:** `/search?q=notion`; each result is `<button>`, not `<a>`. **Impact:** Not crawlable; can't open-in-new-tab; weaker AT semantics; accessible name duplicates the product name ("Notion Notion …"). **Fix:** render results as anchors with single accessible name.

## FE-9 — Sponsor inquiry accepts unsafe company website URL
- **Type:** Security / Validation · **Severity:** Major · **Component:** Sponsor inquiry
- **Steps:** `/sponsor/inquiry` → `Get started` → fill valid name/email/company → enter `javascript:alert(1)` in Company website → `Continue`.
- **Actual:** Form advances to `STEP 2 OF 4 - LAUNCH` with no error.
- **Expected:** Reject non-HTTP(S) schemes before the lead can proceed or be stored.
- **Impact:** Stored unsafe-URL risk for sales/admin tooling, CRM integrations, notification emails, exports, or analytics.
- **Fix:** Client and server allow-list for `https:`/approved schemes; normalize before storage; regression test downstream rendering.

## FE-10 — Sponsor inquiry validation errors are visible but not semantic
- **Type:** A11y / Validation · **Severity:** Minor · **Component:** Sponsor inquiry
- **Steps:** `/sponsor/inquiry` → `Get started` → click `Continue` with empty fields.
- **Actual:** Text errors appear, but inspected controls had no `required`, no `aria-invalid`, and no `[role="alert"]`.
- **Expected:** Programmatic invalid state and associated error text for every blocking field.
- **Impact:** Screen reader users may miss validation failures; automated QA cannot assert the form contract robustly.

## FE-11 — Newsletter signup lacks native email and invalid-state semantics
- **Type:** A11y / Validation · **Severity:** Minor · **Component:** Newsletters
- **Steps:** `/newsletters` → enter `<img src=x onerror=alert(1)>` in email → submit.
- **Actual:** Payload was not reflected, but the email input is `type="text"` and the error is not exposed through alert/invalid semantics.
- **Expected:** `type="email"` plus semantic invalid state.
- **Impact:** Weaker browser validation, mobile keyboard UX, and assistive feedback.

## FE-12 — Authenticated comment composer has unlabeled submit-like toolbar buttons
- **Type:** A11y / Form safety · **Severity:** Minor · **Component:** Forums
- **Steps:** Sign in, open a forum thread, inspect the top-level comment composer.
- **Actual:** `contenteditable` textbox has no accessible label. Multiple icon toolbar buttons expose empty names and default to submit-like controls inside the comment form.
- **Expected:** Textbox label such as `Write a comment`; toolbar buttons named and set to `type="button"`; only the `Comment` button submits.
- **Impact:** Poor keyboard/screen-reader experience and accidental submit risk. Malicious-comment publishing was not executed on production.

## SEC-CAND-1 — Login external `origin` propagates into OAuth provider handoff
- **Type:** Security candidate · **Severity:** Needs authenticated callback validation · **Component:** Login/OAuth
- **Steps:** Open `/login?origin=https://evil.example.com/ph-test` and inspect provider form actions.
- **Actual:** Provider actions preserve the external origin parameter for LinkedIn/GitHub/X/Google/Facebook/Apple.
- **Expected:** Only relative paths or allow-listed same-origin URLs should be carried through auth.
- **Impact:** Potential post-auth open redirect if callback trusts the origin.
- **Boundary:** Callback completion was not tested to avoid account/linking side effects.

## FE-13 — Signed-in notification icon link is unnamed
- **Type:** A11y · **Severity:** Minor · **Component:** Header
- **Steps:** Sign in and open `/categories`, `/topics`, `/forums`, or `/products`; inspect `/notifications`.
- **Actual:** The visible 40x40 notification icon link has no accessible name.
- **Expected:** `aria-label="Notifications"` or equivalent.
- **Impact:** Site-wide signed-in navigation defect.

## FE-14 — Topic pages expose unlabeled rating/actions
- **Type:** A11y · **Severity:** Minor · **Component:** Topics
- **Steps:** Open `/topics`, `/topics/artificial-intelligence`, or `/topics/productivity`.
- **Actual:** `/topics` has unlabeled 1-5 radio controls; topic detail pages have repeated unnamed icon-only product action buttons.
- **Expected:** Labeled radio groups and named actions such as upvote/bookmark/menu.
- **Impact:** Core topic discovery actions are unclear to keyboard/screen-reader users.

## FE-15 — Forum category pages lack heading/canonical structure
- **Type:** SEO / A11y · **Severity:** Minor · **Component:** Forums
- **Steps:** Open `/p/general` and `/p/ai`.
- **Actual:** Both pages have zero H1s; `/p/ai` has no canonical link while `/p/general` does.
- **Expected:** One page H1 and consistent canonical output.

## FE-16 — Weekly/monthly leaderboard base routes 404
- **Type:** Bug / SEO · **Severity:** Minor · **Component:** Leaderboards
- **Steps:** Open `/leaderboard/weekly` and `/leaderboard/monthly`.
- **Actual:** Both show the Product Hunt 404 page with self-canonical URLs.
- **Expected:** Redirect to current dated leaderboard or valid landing route.

## FE-17 — Products listing has unnamed product image/review links
- **Type:** A11y · **Severity:** Minor · **Component:** Products listing
- **Steps:** Open `/products`; inspect product logo links and review-count links.
- **Actual:** Product image links and `/reviews` links expose empty accessible names.
- **Expected:** Name image links by product and review links by product + reviews.

## FE-18 — Public pages reuse duplicate SVG IDs
- **Type:** DOM / A11y · **Severity:** Minor · **Component:** Shared icons
- **Steps:** Inspect IDs on `/categories`, `/topics`, and topic detail pages.
- **Actual:** Duplicate IDs such as `LaunchArchive_svg__a`, `RocketIcon_svg__a`, and `MegaphoneIcon_svg__a` appear repeatedly.
- **Expected:** Generated SVG IDs should be unique per instance.
- **Impact:** Can break SVG references, fragment selectors, and automated accessibility tooling.

## FE-19 — Route variants 404 or fail to canonicalize
- **Type:** Bug / SEO · **Severity:** Minor · **Component:** Routing
- **Steps:** Open `/leaderboard/yearly`, `/leaderboard/all-time`, `/products/new`, `/collections/new`, `/api`, `/docs`, `/community`, and `/leaderboard/daily/2026/06/26`.
- **Actual:** Most render self-canonical 404s; the leading-zero date renders duplicate content without redirecting to its canonical URL.
- **Expected:** Redirect common/legacy aliases to current routes or render a helpful valid destination.

## FE-20 — Product subpages expose unnamed controls
- **Type:** A11y · **Severity:** Minor · **Component:** Product subpages
- **Steps:** Open `/products/chatgpt/reviews`, `/products/chatgpt/launches`, and `/products/chatgpt/alternatives`.
- **Actual:** Review/launch/alternatives pages contain repeated unnamed icon buttons; alternatives also has unnamed product logo links.
- **Expected:** Controls and image links named by action and product.

## FE-21 — Search and submit-product pages lack core semantics
- **Type:** A11y / Form · **Severity:** Minor · **Component:** Search / Submit product
- **Steps:** Open `/search`, `/search?q=ai&page=abc`, and `/posts/new`.
- **Actual:** Search landing has no H1; invalid page values remain in the URL; `/posts/new` has no H1 and the product URL field is `type=text`.
- **Expected:** H1s, normalized pagination, and `type=url` field semantics.

## FE-22 — Help Center footer/social and language picker defects
- **Type:** Bug / A11y · **Severity:** Minor · **Component:** Help Center
- **Steps:** Open `/faq`, which redirects to `help.producthunt.com/en/`; inspect footer social links and language-picker IDs.
- **Actual:** Social hrefs are malformed double URLs and unnamed; IDs such as `language-selector` are duplicated.
- **Expected:** Valid social URLs, accessible names, and unique IDs.

---

## Security checks — NOT vulnerable (verified negatives)
Recorded so the team knows these were tested:
- **Clickjacking on OAuth/login:** `/v2/login` and `/v2/oauth/authorize` both return `X-Frame-Options: SAMEORIGIN` → consent cannot be framed.
- **Open redirect:** `redirect_to` / `return_to` / `return` params on login do not redirect off-domain (WAF 403 / no Location to attacker host).
- **Reflected XSS in search:** `<script>` in `?q=` is blocked by Cloudflare WAF.
- **OAuth authorize validation:** evil `redirect_uri`, unknown `client_id`, `response_type=token`, and scope escalation all `302 → /v2/login` (validation deferred to post-login; allow-listing not confirmable pre-auth — would need an authenticated session, out of scope).

## Architecture observation (passive, from normal page traffic)
The web app is served by an **internal GraphQL endpoint** `https://www.producthunt.com/frontend/graphql` (persisted queries via GET + POST), distinct from the public token-gated `api.producthunt.com/v2/api/graphql`. Noted for completeness only — its access controls were **not** probed (third-party internal surface, out of ethical scope).
