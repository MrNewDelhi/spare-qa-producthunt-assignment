# Findings - Product Hunt Exploratory and Security Assessment

Compiled from live exploration of Product Hunt web, authenticated read-only GraphQL probes, public API/docs research, and the official `producthunt/producthunt-api` repo. Date: 2026-06-27 IST. All testing was read-only: no mutations, no load testing, no brute force, no credential attacks, and no private data access.

Severity key: High, Medium, Low, Info.

## Top 10 Findings

| Rank | Finding | Severity | Area |
|---:|---|---|---|
| 1 | Official OAuth sample omits `state` and stores access tokens in a readable cookie | High | Security / API sample |
| 2 | Official starter proxy drops upstream API status and rate-limit headers | High | API sample / observability |
| 3 | Official API sample dependency stack is severely stale | High | Supply chain |
| 4 | Search out-of-range pagination renders a production 500 | High | Web resilience |
| 5 | GraphQL alias/breadth queries appear to cost the same as tiny queries | Medium | API security / rate limiting |
| 6 | GraphQL invalid cursor and page-size bounds silently fail open | Medium | API contract |
| 7 | Search result products are buttons instead of links | Medium | Frontend / SEO / a11y |
| 8 | Product Hunt docs link to a dead Heroku API Explorer | Medium | Docs / onboarding |
| 9 | Sponsor inquiry accepts a `javascript:` company website and advances the lead form | Medium | Form security |
| 10 | Several public pages/forms have missing/duplicated H1s, unnamed controls, and non-semantic validation | Medium | SEO / a11y |

## Full Findings Backlog

### W1 - Out-of-range search pagination returns HTTP 500

- Severity: High
- Repro: open `https://www.producthunt.com/search?q=notion&page=10000` or `https://www.producthunt.com/search?q=ai&page=1001`.
- Actual: Product Hunt renders a full-page `500` with `Oops, something went wrong on our end`. Console showed Apollo `SERVER_ERROR` and React error `#419`.
- Expected: graceful empty state, redirect/clamp to last valid page, or controlled 404.
- Impact: a public URL can trigger production 5xx noise and poor UX.
- Automated guard: `tests/e2e/search.spec.ts`.

### W2 - Search result product cards are buttons, not links

- Severity: Medium
- Repro: open `/search?q=notion` or `/search?q=ai`; inspect product results.
- Actual: product results render as `<button>` elements but navigate to product pages.
- Expected: navigational product results should be `<a href="...">`.
- Impact: harms SEO/crawlability, open-in-new-tab/copy-link behavior, and assistive semantics.
- Automated guard: `tests/e2e/search.spec.ts`.

### W3 - Search result accessible names duplicate product names

- Severity: Low/Medium
- Repro: inspect accessibility snapshot on `/search?q=notion`.
- Actual: examples include `button "Notion Notion The all-in-one workspace 1.4K reviews"`.
- Expected: product name should be announced once, with supporting metadata after it.
- Impact: screen reader output is noisy and confusing.

### W4 - Misleading `alt="Promoted"` on tracking/decorative images

- Severity: Medium
- Repro: inspect `/` and product pages.
- Actual: many images expose `alt="Promoted"`, including small/tracking-like images. Independent pass found 35 `main img[alt="Promoted"]`, several 1x1.
- Expected: decorative/tracking images should use empty `alt=""`; visible ad labels should be represented once.
- Impact: assistive tech may announce repeated promoted labels unrelated to content.
- Automated guard: `tests/e2e/home.spec.ts`.

### W5 - Newsletter page has no H1

- Severity: Medium
- Repro: open `/newsletters`; inspect headings.
- Actual: `h1Count=0`; page title is `The best products in your inbox`.
- Expected: one clear page-level H1, likely matching the hero/topic.
- Impact: SEO and document navigation regression on a public marketing page.

### W6 - Apps page has no H1

- Severity: Medium
- Repro: open `/apps`; inspect headings.
- Actual: `h1Count=0`; hero text is visible but not an H1.
- Expected: one descriptive H1 such as `Apps` or `Discover the newest way to browse Product Hunt`.
- Impact: SEO and accessibility regression.

### W7 - Sponsor page has 16 H1 elements

- Severity: Medium
- Repro: open `/sponsor`; inspect H1s.
- Actual: H1s include `Reach millions of early adopters`, `Find new customers`, campaign tiers, success story names, and community sections.
- Expected: one page-level H1; subsections should use lower-level headings.
- Impact: weak page hierarchy for search engines and screen readers.

### W8 - Stories page has no H1 or semantic heading structure

- Severity: Medium
- Repro: open `/stories`; inspect headings.
- Actual: page has story content but no H1/headings in the inspected DOM.
- Expected: a page-level heading such as `Stories` and semantic section headings.
- Impact: poor navigability for assistive technology and weaker SEO.

### W9 - Changelog page has multiple H1 elements and many unnamed controls

- Severity: Medium
- Repro: open `/changes`; inspect headings/buttons.
- Actual: H1s include `Changelog` plus multiple individual feature-update titles; page also contained many empty buttons.
- Expected: one page-level H1 and named controls.
- Impact: document structure and keyboard/screen-reader usability issues.

### W10 - Legal page has duplicate `id="privacy"` and two H1s

- Severity: Medium
- Repro: open `/legal`; inspect IDs and hash links.
- Actual: both a wrapping element and nested section use `id="privacy"`; page has H1s for `Terms of Service` and `Privacy & Cookies Policy`.
- Expected: IDs must be unique; hash links should target one element; one page-level H1 unless split into separate documents.
- Impact: ambiguous hash navigation and accessibility/SEO issues.

### W11 - `/leaderboard/daily` returns a public 404

- Severity: Medium
- Repro: open `https://www.producthunt.com/leaderboard/daily`.
- Actual: 404 page with canonical still set to `/leaderboard/daily`.
- Expected: redirect to current dated leaderboard or a valid daily leaderboard route.
- Impact: a discoverable base route is broken while dated leaderboard URLs work.

### W12 - Apps store badge links are unnamed

- Severity: Medium
- Repro: open `/apps`; inspect App Store / Play Store badge links.
- Actual: links to `producthunt.app.link/appstore` and `producthunt.app.link/playstore` are SVG/image-only anchors with no accessible name.
- Expected: labels such as `Download on the App Store` and `Get it on Google Play`.
- Impact: screen reader users cannot understand the link purpose.

### W13 - About page image-only press/investor links are unnamed

- Severity: Medium
- Repro: open `/about`; inspect press/investor logo links.
- Actual: external logo links for publications/investors expose empty accessible names.
- Expected: each logo link should expose the publication/investor name.
- Impact: inaccessible important outbound links.

### W14 - Footer social icon links are unnamed

- Severity: Low/Medium
- Repro: inspect footer on `/privacy/do-not-sell` or other public pages.
- Actual: X and LinkedIn icon links have empty accessible names.
- Expected: labels like `Product Hunt on X` and `Product Hunt on LinkedIn`.
- Impact: repeated site-wide accessibility issue.

### W15 - Mobile hamburger menu is unnamed and undersized

- Severity: Medium
- Repro: mobile viewport on `/search?q=ai`, `/legal`, or `/products/chatgpt`.
- Actual: hamburger button has no text/`aria-label` and was measured around `24x14`.
- Expected: name like `Open navigation menu` and target closer to 44x44 CSS px.
- Impact: mobile accessibility and touch-target issue.

### W16 - Forum cards use `aria-hidden` overlay links

- Severity: Medium
- Repro: mobile `/forums`; inspect forum cards.
- Actual: cards contain full-size anchors like `<a aria-hidden="true" class="absolute inset-0 -z-10" href="/p/..."></a>`.
- Expected: card navigation should use a named link, or decorative overlay should not be focusable/navigational.
- Impact: conflicting semantics and potential keyboard/screen-reader confusion.

### W17 - Forum post images are missing alt text

- Severity: Medium
- Repro: open `/forums`; inspect cards with embedded images.
- Actual: several visible post images render as `<img src="...">` with no `alt`.
- Expected: informative images need descriptive alt; decorative images need `alt=""`.
- Impact: assistive technology cannot interpret visible post media.

### W18 - Product detail has unnamed dialog-trigger buttons

- Severity: Medium
- Repro: open `/products/chatgpt` on mobile; inspect icon/avatar/badge buttons.
- Actual: multiple `aria-haspopup="dialog"` buttons have no text or `aria-label`.
- Expected: labels such as `View badge details` or `Open reviewer profile card for ...`.
- Impact: screen reader and keyboard users encounter unnamed interactive controls.

### W19 - Product review search lacks an explicit label

- Severity: Low/Medium
- Repro: open `/products/chatgpt`; inspect `Search reviews...` input.
- Actual: input relies on placeholder with no visible label, `aria-label`, or `title`.
- Expected: programmatic label such as `aria-label="Search reviews"`.
- Impact: label can disappear as the user types; weaker form accessibility.

### W20 - `/ads/new` redirects anonymous users to login with login canonical

- Severity: Low/Medium
- Repro: click self-serve portal from `/sponsor/inquiry` or open `/ads/new` anonymously.
- Actual: URL becomes `/login?origin=%2Fads%2Fnew`, canonical is `/login`, and page is a generic sign-up/sign-in screen.
- Expected: advertising self-serve entry should either explain auth requirement or preserve a useful ads-specific landing state.
- Impact: confusing funnel for advertisers, and canonical signals do not represent the original ads intent.

### W21 - Sponsor inquiry accepts unsafe `javascript:` company website URL

- Severity: Medium/High
- Repro: open `/sponsor/inquiry`, click `Get started`, fill step 1 with a valid name/email/company, set Company website to `javascript:alert(1)`, then click `Continue`.
- Actual: the form advances to `STEP 2 OF 4 - LAUNCH` with no validation error.
- Expected: the company website field should reject non-HTTP(S) schemes client-side and server-side before the lead is stored or submitted to a CRM/sales workflow.
- Impact: unsafe URL schemes can enter advertiser lead data. Even if rendered safely today, this is a stored-data security risk for admin tooling, CRM integrations, email templates, and analyst exports.
- Boundary: the launch URL field on step 2 did reject the same `javascript:` value with a visible "No matches" state, so the gap is field-specific.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W22 - Sponsor inquiry validation messages are not exposed semantically

- Severity: Medium
- Repro: open `/sponsor/inquiry`, click `Get started`, then click `Continue` on an empty step 1.
- Actual: visible errors appear (`Please tell us your name.`, `Enter a valid email so we can write back.`), but no `[role="alert"]`, no `[aria-invalid="true"]`, and the inputs are not `required`.
- Expected: invalid fields should expose programmatic invalid state and associated error text.
- Impact: screen reader users may miss the blocking validation, and automated form QA cannot reliably assert the validation contract.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W23 - Newsletter invalid email validation is generic and non-semantic

- Severity: Low/Medium
- Repro: open `/newsletters`, enter `<img src=x onerror=alert(1)>` in the email field, and click `Sign me up`.
- Actual: the payload is not reflected as HTML or text, which is good, but the input is `type="text"` and the error has no alert role or `aria-invalid` state.
- Expected: email inputs should use `type="email"` and expose invalid state with an associated message.
- Impact: weaker built-in browser validation, mobile keyboard UX, and assistive-technology feedback.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W24 - Authenticated forum comment composer has unnamed submit-like toolbar buttons

- Severity: Medium
- Repro: sign in, open `/p/general/what-are-the-5-tools-you-simply-couldn-t-do-your-work-without?bc=1`, inspect the top-level comment composer.
- Actual: the composer has a `contenteditable` textbox with no accessible label. Its formatting/upload toolbar buttons are visually icon-only, expose empty accessible names, and several default to submit-type controls inside the same form as the real `Comment` submit button.
- Expected: editor toolbar buttons should be `type="button"` with labels such as Bold, Italic, Link, Upload image, etc.; the textbox should expose a label like `Write a comment`.
- Impact: keyboard/screen-reader users encounter unlabeled controls, and submit-default toolbar buttons increase accidental form-submit risk. A malicious-comment sanitization test should be run only with a disposable account and explicit permission to publish or with a staging environment.

### W25 - Authenticated header notification icon link is unnamed

- Severity: Medium
- Repro: sign in and open `/categories`, `/topics`, `/forums`, `/p/general`, or `/products`; inspect the header notification icon.
- Actual: the `/notifications` anchor is visible at `40x40` but has no text, `aria-label`, title, or image alt.
- Expected: icon-only navigation links should expose names such as `Notifications`.
- Impact: signed-in screen reader users encounter a recurring unnamed navigation link on nearly every page.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W26 - Public pages reuse duplicate SVG IDs

- Severity: Low/Medium
- Repro: inspect IDs on `/categories`, `/topics`, `/forums`, `/topics/artificial-intelligence`, or `/topics/productivity`.
- Actual: duplicate IDs such as `LaunchArchive_svg__a` appear on many pages; topic detail pages also repeat IDs like `RocketIcon_svg__a`, `MegaphoneIcon_svg__a`, and `FirstIcon_svg__a` many times.
- Expected: IDs in the final DOM should be unique, including generated SVG gradient/clipPath IDs.
- Impact: duplicate IDs can break fragment references, SVG paint servers, automated a11y tooling, and CSS/JS selectors.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W27 - Footer Events link opens a new tab without `rel="noopener"`

- Severity: Low/Medium
- Repro: inspect the footer `Events` link on `/categories`, `/topics`, `/forums`, `/p/general`, or other public pages.
- Actual: `https://lu.ma/producthunt` opens with `target="_blank"` and empty `rel`.
- Expected: cross-origin new-tab links should include `rel="noopener noreferrer"` unless a deliberate opener relationship is required.
- Impact: reverse-tabnabbing/opener risk and a weak link-security pattern repeated site-wide.

### W28 - `/topics` rating controls are unlabeled radio inputs

- Severity: Medium
- Repro: open `/topics` and inspect the visible 1-5 rating/shoutout controls in product cards.
- Actual: radio inputs have values `1` through `5` but no `name`, no `id`, no `aria-label`, and no associated `<label>`.
- Expected: each radio group should have a group name and each option should be programmatically labeled.
- Impact: assistive technology cannot describe what the rating controls do, and ungrouped radios weaken keyboard/form behavior.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W29 - `/topics` topic/product image links are unnamed

- Severity: Medium
- Repro: open `/topics`; inspect the image-only links for popular launch tags and product cards.
- Actual: links such as `/topics/design-tools`, `/topics/artificial-intelligence`, and product logo links expose empty accessible names.
- Expected: image-only links should have an accessible name matching the topic/product.
- Impact: screen reader users cannot understand or choose several prominent navigation links.

### W30 - Forum category pages have no H1

- Severity: Medium
- Repro: open `/p/general` or `/p/ai`; inspect page-level headings.
- Actual: `h1` count is `0` even though the pages represent category/forum landing pages.
- Expected: one H1 such as `p/general` or a human-readable forum category name.
- Impact: weak SEO/document outline and difficult navigation for assistive technology.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W31 - `/p/ai` lacks a canonical URL

- Severity: Low/Medium
- Repro: open `/p/ai` and inspect `<link rel="canonical">`.
- Actual: no canonical link is present, while `/p/general` does emit `https://www.producthunt.com/p/general`.
- Expected: forum category pages should emit consistent self-canonicals or an intentional canonical target.
- Impact: inconsistent SEO signals for near-identical forum category templates.

### W32 - `/leaderboard/weekly` returns a public 404

- Severity: Medium
- Repro: open `https://www.producthunt.com/leaderboard/weekly`.
- Actual: 404 page with canonical `https://www.producthunt.com/leaderboard/weekly`.
- Expected: redirect to the current weekly leaderboard or a valid dated weekly route.
- Impact: discoverable leaderboard base route is broken while the header promotes leaderboard navigation.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W33 - `/leaderboard/monthly` returns a public 404

- Severity: Medium
- Repro: open `https://www.producthunt.com/leaderboard/monthly`.
- Actual: 404 page with canonical `https://www.producthunt.com/leaderboard/monthly`.
- Expected: redirect to the current monthly leaderboard or a valid dated monthly route.
- Impact: same broken base-route pattern as daily/weekly, hurting discoverability and deep links.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W34 - `/alternatives` returns a public 404

- Severity: Low/Medium
- Repro: open `https://www.producthunt.com/alternatives`.
- Actual: public 404 with self-canonical `/alternatives`.
- Expected: a valid alternatives index, redirect to a supported alternatives search flow, or no self-canonical 404.
- Impact: common SEO/navigation pattern for product alternatives is a dead route.

### W35 - Topic detail pages contain many unnamed product action buttons

- Severity: Medium
- Repro: open `/topics/artificial-intelligence` or `/topics/productivity`; inspect product rows around the launch lists.
- Actual: repeated icon-only buttons around product cards are visible but expose empty accessible names.
- Expected: action buttons should be labeled, for example `Upvote <product>`, `Bookmark <product>`, or `Open menu for <product>`.
- Impact: assistive technology users cannot identify repeated primary actions.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W36 - `/products` listing has image/review links with empty accessible names

- Severity: Medium
- Repro: open `/products`; inspect product logo links and review-count links.
- Actual: links such as `/products/fundraisly`, `/products/upstream-3`, and their `/reviews` links expose no accessible name.
- Expected: product image links should be named by product; review links should be named like `<product> reviews`.
- Impact: the best-products listing contains repeated unnamed navigation links for core content.
- Automated guard: `tests/e2e/public-pages.spec.ts`.

### W37 - `/leaderboard` has no page-level H1

- Severity: Medium
- Repro: open `https://www.producthunt.com/leaderboard`.
- Actual: the page renders the leaderboard calendar/archive UI but has zero visible `h1` elements.
- Expected: one page-level H1 such as `Leaderboard`.
- Impact: poor document outline and weaker SEO/a11y for a primary navigation destination.

### W38 - Leading-zero leaderboard date URL returns duplicate 200 instead of redirecting

- Severity: Low/Medium
- Repro: open `/leaderboard/daily/2026/06/26`.
- Actual: page renders HTTP-success content at the leading-zero URL while canonical points to `/leaderboard/daily/2026/6/26`; the address bar remains `/2026/06/26`.
- Expected: redirect to the canonical non-zero-padded date URL or consistently canonicalize URL shape server-side.
- Impact: duplicate leaderboard URLs and weaker crawl/share consistency.

### W39 - `/leaderboard/yearly` returns a public 404

- Severity: Medium
- Repro: open `https://www.producthunt.com/leaderboard/yearly`.
- Actual: 404 page with self-canonical `/leaderboard/yearly` and `noindex`.
- Expected: valid yearly leaderboard route or redirect to the supported yearly route, especially because leaderboard navigation exposes a `Yearly` mode.
- Impact: discoverable leaderboard mode has a dead base URL.

### W40 - `/leaderboard/all-time` returns a public 404

- Severity: Low/Medium
- Repro: open `https://www.producthunt.com/leaderboard/all-time`.
- Actual: 404 page with self-canonical `/leaderboard/all-time`.
- Expected: valid all-time leaderboard route or no self-canonical 404 for a likely discoverable route.
- Impact: another dead leaderboard route pattern around advertised archive modes.

### W41 - `/categories/marketing` returns a public 404

- Severity: Low/Medium
- Repro: open `https://www.producthunt.com/categories/marketing`.
- Actual: 404 page with self-canonical `/categories/marketing`.
- Expected: redirect to the correct marketing category/tag route or render a valid category landing page.
- Impact: common category slug is dead while marketing-related topics exist elsewhere.

### W42 - `/categories/artificial-intelligence` returns a public 404 while `/topics/artificial-intelligence` works

- Severity: Low/Medium
- Repro: open `/categories/artificial-intelligence` and compare with `/topics/artificial-intelligence` or `/categories/ai`.
- Actual: `/categories/artificial-intelligence` 404s; `/categories/ai` redirects to `/categories/ai-software`; `/topics/artificial-intelligence` works.
- Expected: common AI category aliases should redirect consistently or be intentionally excluded from generated/discoverable links.
- Impact: inconsistent category/topic IA and likely broken deep links from users or search.

### W43 - Category detail pages contain unnamed product action buttons

- Severity: Medium
- Repro: open `/categories/ai`, `/categories/productivity`, or `/categories/design-tools`; inspect product cards.
- Actual: repeated icon-only product action buttons are visible but expose empty accessible names.
- Expected: action buttons should be labeled by purpose and product, such as `Upvote <product>` or `Bookmark <product>`.
- Impact: same core action accessibility gap as topic pages, but on category-detail templates.

### W44 - Product review pages contain unnamed review/action buttons

- Severity: Medium
- Repro: open `/products/chatgpt/reviews` or `/products/fundraisly/reviews`; inspect the review cards and page actions.
- Actual: multiple visible buttons around review cards have no accessible name, including 20-24px rating/reaction controls and 48px avatar/action buttons.
- Expected: each review action should expose a meaningful name.
- Impact: review interactions are difficult or impossible to operate with assistive technology.

### W45 - Product launch history pages contain unnamed action buttons

- Severity: Medium
- Repro: open `/products/chatgpt/launches`; inspect the launches list.
- Actual: repeated icon-only buttons around launches expose empty names.
- Expected: launch list actions should be labeled by action and launch/product.
- Impact: inaccessible actions on a product subpage that is reachable from public product navigation.

### W46 - Product alternatives pages have unnamed product logo links and action buttons

- Severity: Medium
- Repro: open `/products/chatgpt/alternatives`; inspect alternative product rows.
- Actual: alternative product logo links such as `/products/claude`, `/products/gemini-6`, and `/products/typing-mind` are unnamed; repeated action buttons are also unnamed.
- Expected: logo links should be named by product, and action buttons should expose their purpose.
- Impact: alternatives comparison pages are difficult to navigate non-visually.

### W47 - Search landing page has no H1

- Severity: Medium
- Repro: open `/search` or `/search?q=`.
- Actual: page renders popular launch tags and product categories, but has zero visible `h1` elements.
- Expected: one H1 such as `Search Product Hunt` or `Explore Product Hunt`.
- Impact: weak document structure for a core discovery page.

### W48 - Search accepts invalid page values without URL normalization

- Severity: Low/Medium
- Repro: open `/search?q=ai&page=0`, `/search?q=ai&page=-5`, or `/search?q=ai&page=abc`.
- Actual: all render search results and keep the invalid `page` value in the URL.
- Expected: invalid page values should redirect/clamp to page 1 or return a controlled validation state.
- Impact: inconsistent pagination behavior; small invalid values silently succeed while large invalid values trigger the W1 server error.

### W49 - Submit-product page has no H1

- Severity: Medium
- Repro: open `/posts/new`.
- Actual: the submit-product flow renders `Submit a product` text but zero visible H1 elements.
- Expected: one page-level H1 such as `Submit a product`.
- Impact: poor accessibility and page outline for a primary maker workflow.

### W50 - Submit-product URL field uses `type="text"` instead of URL semantics

- Severity: Low/Medium
- Repro: open `/posts/new`; inspect the `Link to the product` field.
- Actual: form control `name="url"` has `type="text"` and placeholder `www.producthunt.com`.
- Expected: use `type="url"`, input mode/validation semantics, and an explicit label association.
- Impact: weaker browser validation, mobile keyboard UX, and form accessibility for the first step of submission.

### W51 - New thread composer has unlabeled editor and submit-type toolbar buttons

- Severity: Medium
- Repro: open `/p/new` or `/p/new?category=general`; inspect the composer.
- Actual: the rich-text editor is a `role="textbox"` contenteditable with no accessible label. Toolbar buttons are icon-only and many are `type="submit"` within the form.
- Expected: editor should be labeled, toolbar controls should be named and `type="button"`, and only the final submit action should submit the form.
- Impact: accidental submit risk and inaccessible thread creation workflow.

### W52 - `/products/new` returns a public 404 despite product submission living at `/posts/new`

- Severity: Low/Medium
- Repro: open `/products/new`.
- Actual: 404 page with self-canonical `/products/new`.
- Expected: redirect to `/posts/new` or another valid product submission route.
- Impact: likely guessed/legacy route for creating a product is dead instead of helping makers recover.

### W53 - Signed-in settings routes return 404

- Severity: Medium candidate
- Repro: while signed in, open `/settings`, `/settings/profile`, `/settings/notifications`, or `/settings/account`.
- Actual: all inspected settings routes render Product Hunt 404 pages with self-canonicals.
- Expected: signed-in account/profile settings should either render or redirect to the current settings/profile management location.
- Impact: common account-management deep links are broken; candidate because current settings may be intentionally routed elsewhere.

### W54 - `/my/collections` returns a public 404 while `/collections` works

- Severity: Low/Medium
- Repro: while signed in, open `/my/collections`, then compare `/collections`.
- Actual: `/my/collections` returns a 404; `/collections` renders the public collections index.
- Expected: user-owned collections should render, redirect, or explain where collection management moved.
- Impact: common signed-in personal-content route is broken.

### W55 - `/collections/new` returns a public 404

- Severity: Low/Medium
- Repro: open `/collections/new`.
- Actual: 404 page with self-canonical `/collections/new`.
- Expected: create-collection flow, login/permission gate, or redirect to valid collection creation path.
- Impact: guessed/deep-linked collection creation route dead-ends.

### W56 - Help Center social links are malformed double URLs and unnamed

- Severity: Medium
- Repro: open `/faq`, which redirects to `https://help.producthunt.com/en/`; inspect footer social icons.
- Actual: social hrefs are malformed, e.g. `https://www.twitter.com/https://x.com/ProductHunt` and `https://www.linkedin.com/https://www.linkedin.com/company/producthunt/`, and the links have no accessible names.
- Expected: direct valid social URLs with accessible names.
- Impact: Help Center footer social links are broken and inaccessible.

### W57 - Help Center reuses duplicate language-picker IDs

- Severity: Low/Medium
- Repro: open `/faq` / `https://help.producthunt.com/en/`; inspect DOM IDs.
- Actual: duplicate IDs include `language-selector`, `locale-picker-globe`, and `locale-picker-arrow`.
- Expected: IDs should be unique in the rendered help-center DOM.
- Impact: weak accessibility/tooling hygiene on the help surface, especially around language selection.

### W58 - `/api` and `/docs` on the main domain 404 instead of redirecting to current API docs

- Severity: Low/Medium
- Repro: open `/api` or `/docs` on `www.producthunt.com`.
- Actual: both render 404 pages; `/api/docs` rewrites/lands at `@api/docs` and still 404s, while `/v2/docs` works.
- Expected: redirect common documentation entry points to `/v2/docs` or `https://api.producthunt.com/v2/docs`.
- Impact: common developer documentation guesses dead-end.

### W59 - `/deals` returns a public 404

- Severity: Low
- Repro: open `https://www.producthunt.com/deals`.
- Actual: 404 page with self-canonical `/deals`.
- Expected: if deals are retired, redirect to a current equivalent or avoid self-canonical 404 for a common legacy commerce route.
- Impact: legacy/deep-link UX and SEO dead-end.

### W60 - `/community` returns a public 404 while forums/community navigation exists elsewhere

- Severity: Low/Medium
- Repro: open `https://www.producthunt.com/community`.
- Actual: 404 page with self-canonical `/community`.
- Expected: redirect to `/forums` or another current community landing page.
- Impact: common community URL dead-ends instead of recovering to the active forum/community experience.

### W61 - Signed-in `/messages` route returns a 404

- Severity: Low/Medium
- Repro: while signed in, open `/messages`.
- Actual: Product Hunt renders its 404 page with self-canonical `/messages`.
- Expected: message inbox, redirect to the current inbox route, or an intentional no-messaging state.
- Impact: common signed-in communication deep link is broken.

### W62 - Signed-in `/bookmarks` route returns a 404

- Severity: Low/Medium
- Repro: while signed in, open `/bookmarks`.
- Actual: Product Hunt renders its 404 page with self-canonical `/bookmarks`.
- Expected: saved/bookmarked products page, redirect, or an explanatory empty state.
- Impact: common personal-content route dead-ends.

### W63 - `/help` returns a main-site 404 while `/faq` redirects to the Help Center

- Severity: Low/Medium
- Repro: open `/help`, then open `/faq`.
- Actual: `/help` 404s on the main site; `/faq` redirects to `https://help.producthunt.com/en/`.
- Expected: `/help` should redirect to the same Help Center landing page or another current support route.
- Impact: common support URL fails even though a working Help Center exists.

### A12 - Login `origin` accepts external URLs into OAuth provider handoff

- Severity: Medium candidate
- Repro: open `/login?origin=https://evil.example.com/ph-test` and inspect provider form actions.
- Actual: OAuth provider forms preserve the external origin, e.g. `/auth/github?origin=https%3A%2F%2Fevil.example.com%2Fph-test&source_component=SystemLogin`. Protocol-relative `//evil.example.com/ph-test` is also preserved. A `javascript:` origin was blocked by the edge/WAF.
- Expected: login origins should be restricted to relative paths or an allow-listed same-origin URL before entering the OAuth handoff.
- Impact: potential post-auth open-redirect or phishing-link risk if any provider callback later trusts the carried `origin`.
- Boundary: this was not confirmed as a full open redirect because completing the provider callback would create authenticated external side effects; treat it as a candidate requiring authenticated callback validation.

### A13 - Non-string GraphQL `query` values return HTTP 500

- Severity: Medium
- Repro: authenticated POST JSON with `{"query":123}`, `{"query":true}`, `{"query":{"x":1}}`, or `{"query":["..."]}`.
- Actual: HTTP 500 with `{"errors":[{"message":"SERVER_ERROR"}],"data":{}}`.
- Expected: HTTP 400 with a clear validation error such as `query must be a string`.
- Impact: malformed client input can trigger server-error noise and hides the actual contract violation.

### A14 - Non-object GraphQL `variables` values can return HTTP 500

- Severity: Medium
- Repro: authenticated POST with a variable query and `variables: [1]` or `variables: 1`.
- Actual: HTTP 500 `SERVER_ERROR`.
- Expected: HTTP 400 validation error because GraphQL variables must be an object/map or null.
- Impact: another parser-contract path that surfaces as a server error.

### A15 - Unknown `operationName` is ignored for single-operation documents

- Severity: Low/Medium
- Repro: POST `query A { posts(first:1){ edges{ node{ id } } } }` with `operationName: "B"`.
- Actual: API executes operation `A` successfully.
- Expected: structured error such as `Unknown operation named B`.
- Impact: client bugs can execute the wrong operation instead of failing closed.

### A16 - Stringified `variables` is accepted/ignored instead of rejected

- Severity: Low/Medium
- Repro: POST a variable query with `variables: "{\"n\":1}"`.
- Actual: API returns data instead of rejecting `variables` as the wrong type.
- Expected: variables must be a JSON object, not a string.
- Impact: client serialization bugs are masked and can silently use default/null variable behavior.

### A17 - Malformed JSON returns empty HTML 400 instead of JSON error

- Severity: Low/Medium
- Repro: POST `Content-Type: application/json` with malformed body such as `{"query":`.
- Actual: HTTP 400 with `content-type: text/html; charset=UTF-8` and empty body.
- Expected: JSON error envelope with parse failure details and request ID.
- Impact: API clients cannot handle malformed-body errors consistently.

### A18 - `application/graphql` bodies get misleading `query_missing`

- Severity: Low
- Repro: POST raw GraphQL with `Content-Type: application/graphql`.
- Actual: HTTP 400 `query_missing`.
- Expected: either support the standard GraphQL media type or return `unsupported_content_type`.
- Impact: misleading error slows client integration and debugging.

### A19 - URL-encoded GraphQL query bodies are accepted but undocumented

- Severity: Low
- Repro: POST `application/x-www-form-urlencoded` body with a `query=` parameter.
- Actual: API executes the query successfully.
- Expected: docs should document supported content types, or API should reject unsupported encodings consistently.
- Impact: clients may unknowingly depend on an undocumented parser path.

### A20 - CORS allows arbitrary origins with `Authorization`

- Severity: Low/Medium
- Repro: preflight with `Origin: https://evil.example`, `Access-Control-Request-Headers: authorization,content-type`; then POST with the same origin.
- Actual: response includes `access-control-allow-origin: *`, allows `authorization,content-type`, and exposes rate-limit headers.
- Expected: document this as intentional public-token API posture or restrict origins for browser token usage.
- Impact: any website can call the API with a bearer token available in browser JS; acceptable only if this is an explicit server-to-server design decision.

### A21 - CORS advertises `HEAD`, but `HEAD /v2/api/graphql` returns HTML 404

- Severity: Low/Medium
- Repro: OPTIONS advertises `GET, POST, HEAD, OPTIONS`; authenticated `HEAD /v2/api/graphql` returns 404.
- Actual: HTML 404 response, not JSON/405/empty successful API response.
- Expected: supported methods should match advertised methods, or unsupported methods should not be advertised.
- Impact: browser/API clients see a contradictory method contract.

### A22 - Batched GraphQL array bodies get misleading `query_missing`

- Severity: Low
- Repro: POST a JSON array of two GraphQL operations.
- Actual: HTTP 400 `query_missing`.
- Expected: explicit `batching_not_supported` or schema-compatible validation error.
- Impact: clients using common GraphQL batching conventions receive an unrelated missing-query message.

### A23 - Nullable `first` variable set to null silently returns default page size

- Severity: Low/Medium
- Repro: query `query($n:Int){ posts(first:$n){ edges{ node{ id } } } }` with `variables: {"n": null}`.
- Actual: API returns 20 posts.
- Expected: either reject null for pagination size or document the default behavior clearly.
- Impact: pagination bugs can silently fetch a full default page instead of surfacing invalid input.

### A24 - Parser/validation errors consume rate-limit budget inconsistently

- Severity: Low/Medium
- Repro: compare malformed parser errors: `query_missing` responses omit `x-rate-limit-*`, while invalid query/variables type paths include rate-limit headers and decrement remaining quota.
- Actual: some client-side contract errors cost 100 points; other 400 parser errors appear outside the rate-limit contract.
- Expected: document which validation stages consume quota, or make parser/validation accounting consistent.
- Impact: confusing client observability and potential accidental quota burn during integration debugging.

### A1 - GraphQL auth errors use a non-GraphQL shape

- Severity: Medium
- Repro: POST a valid query with no bearer token or invalid token.
- Actual: `HTTP 401` with `errors[0].error = invalid_oauth_token`; no `errors[0].message`.
- Expected: consistent GraphQL error shape or standard bearer-auth response.
- Impact: clients must special-case auth vs GraphQL errors; missing/invalid tokens are indistinguishable.
- Automated guard: `tests/api/auth.test.ts`.

### A2 - Missing query body is validated pre-auth with a third error shape

- Severity: Low/Medium
- Repro: POST `{}` to `/v2/api/graphql` without auth.
- Actual: `HTTP 400` with `query_missing`.
- Expected: docs should describe pre-auth parser errors and rate-header behavior.
- Impact: more client special-casing; useful to test for no stack/internal leakage.
- Automated guard: `tests/api/auth.test.ts`.

### A3 - `first` is silently clamped above 20

- Severity: Medium
- Repro: authenticated `posts(first: 50)`.
- Actual: HTTP 200 returns exactly 20 edges and no warning.
- Expected: documented maximum, validation error, or metadata explaining truncation.
- Impact: silent data loss and pagination bugs.

### A4 - Invalid cursors are ignored

- Severity: Medium
- Repro: authenticated `posts(first: 2, after: "not_a_cursor")`.
- Actual: returns the first page with cursors `MQ`, `Mg`.
- Expected: structured validation error for invalid cursor.
- Impact: masks client bugs and can cause duplicate processing/infinite loops.
- Automated guard: `tests/api/pagination.test.ts`.

### A5 - `first: 0` and negative `first` return empty results

- Severity: Low/Medium
- Repro: `posts(first: 0)` and `posts(first: -5)`.
- Actual: HTTP 200 with empty edges.
- Expected: validation error for invalid pagination values.
- Impact: silent failure instead of contract enforcement.

### A6 - GraphQL introspection is enabled in production

- Severity: Low/Medium
- Repro: `{ __schema { queryType { fields { name } } mutationType { fields { name } } types { name kind } } }`.
- Actual: full schema, mutations, deprecated fields, and object types are visible.
- Expected: confirm intentional posture; many production GraphQL APIs restrict introspection.
- Impact: exposes full attack surface and undocumented fields.
- Automated guard: `tests/api/security.test.ts`.

### A7 - Field suggestions disclose schema names

- Severity: Low
- Repro: `{ postz { id } }`.
- Actual: validation error includes `Did you mean post or posts?`.
- Expected: confirm whether suggestion disclosure is acceptable in production.
- Impact: schema discovery remains available even if introspection is disabled later.

### A8 - Complexity/rate-limit debit appears flat for broad aliases

- Severity: Medium
- Repro: compare a tiny `posts(first: 1)` query with a five-alias `posts(first: 20)` query with many fields.
- Actual: both decremented `x-rate-limit-remaining` by 100; the broad response was much larger.
- Expected: cost should scale with aliases, fields, and node volume as docs imply.
- Impact: more data per rate-limit point than intended; relevant for scraping/fairness.
- Boundary: deep vertical nesting is blocked by depth/max-complexity controls.
- Automated guard: `tests/api/security.test.ts`.

### A9 - CORS advertises methods that do not work as API methods

- Severity: Low/Medium
- Repro: unauthenticated OPTIONS advertises `GET, POST, HEAD, OPTIONS`; `GET /v2/api/graphql?query=...` returns HTML 404.
- Expected: supported methods should align with CORS, or unsupported methods should return JSON/405.
- Impact: confusing browser/API contract.
- Automated guard: `tests/api/auth.test.ts`.

### A10 - Rate-limit docs say every response includes headers, but unauth errors do not

- Severity: Medium
- Repro: compare docs with no-token 400/401 responses.
- Actual: unauthenticated 400/401 responses do not include `x-rate-limit-*`.
- Expected: docs should say headers are only guaranteed for authenticated/processed API responses, or server should include them consistently.
- Impact: client observability and test contract confusion.

### A11 - Public voter/user relationship data is enumerable

- Severity: Low/Medium
- Repro: query post votes with voter user ids/names/usernames; query sequential user IDs.
- Actual: public voter relationships and sequential user IDs are visible.
- Expected: confirm intended privacy stance and rate-cost relationships appropriately.
- Impact: public-by-design data can still enable bulk profiling/scraping.

### D1 - API docs link to dead Heroku API Explorer

- Severity: Medium
- Repro: follow `API Explorer` from Product Hunt v2 docs or README to `https://ph-graph-api-explorer.herokuapp.com/`.
- Actual: Heroku `404 No such app`.
- Expected: working explorer, redirect, or removed link.
- Impact: broken developer onboarding path.

### D2 - API dashboard links drift and can lose path

- Severity: Medium
- Repro: docs/README point to both `api.producthunt.com/v2/oauth/applications` and `www.producthunt.com/v2/oauth/applications`; focused checks saw redirects/challenges and open issues report dashboard access failures.
- Expected: one canonical working dashboard URL and clear unauthenticated sign-in behavior.
- Impact: developers cannot reliably create/manage API apps.

### D3 - Machine-readable endpoints are challenged or missing

- Severity: Medium
- Repro: request `robots.txt`, `llms.txt`, `.well-known/security.txt`, or root sitemap paths from public clients.
- Actual: CLI checks hit Cloudflare JS challenge for machine-readable files; browser check showed `.well-known/security.txt` and `/sitemap.xml` rendering app 404 pages.
- Expected: plain text/XML/security disclosure resources should be available without JS.
- Impact: SEO crawlers, LLM crawlers, and security researchers may not get intended machine-readable data.

### D4 - API reference accepts slash and non-slash variants without canonical

- Severity: Low
- Repro: open `https://api-v2-docs.producthunt.com/operation/query` and `/operation/query/`.
- Actual: both return 200; no canonical tag found in fetched HTML.
- Expected: redirect or canonical to one URL.
- Impact: duplicate docs URLs and weaker SEO hygiene.

### D5 - Deprecated GraphQL fields have no concrete sunset

- Severity: Low/Medium
- Repro: inspect `User.followers` / `User.following` docs.
- Actual: fields are deprecated with `will be removed in a future version`, but no date/version.
- Expected: documented replacement, version, and sunset timeline.
- Impact: client migration risk and contract ambiguity.

### D6 - Product Hunt API/support issue backlog shows repeated unresolved onboarding failures

- Severity: Medium
- Evidence: open GitHub issues report API dashboard 404/403, Cloudflare/token problems, rate-limit increase requests, schema/field confusion, and upvoter/privacy questions.
- Expected: active API product should have clear support path and resolved onboarding blockers.
- Impact: developer success risk beyond a single bug.

### D7 - API docs route developers to GitHub, but issue creation is restricted

- Severity: Medium
- Repro: open `https://api.producthunt.com/v2/docs` and follow the `let us know on GitHub` support path to `https://github.com/producthunt/producthunt-api/issues`.
- Actual: docs ask developers to report ideas/problems on GitHub with a `v2` label, but the repo issue list says `New issue Issue creation is restricted in this repository`. The repo also shows 49 issues.
- Expected: public docs should point to a support path where developers can actually file API feedback, or explain the preferred contact channel.
- Impact: developers hit a dead-end support workflow for API bugs, access failures, rate-limit requests, and schema questions.

### R1 - Official OAuth sample omits `state`

- Severity: High
- Evidence: `routes/authorize.js` builds the OAuth authorize URL without `state`; `routes/callback.js` exchanges `req.query.code` without validating state.
- Expected: OAuth sample should generate, store, send, and validate `state`.
- Impact: copy-pasted integrations inherit OAuth CSRF / authorization-code injection risk.

### R2 - Official sample stores access token in a readable signed JWT cookie

- Severity: High
- Evidence: README says token is encrypted, but code uses `jwt.sign(accessToken, SECRET)` and `res.cookie("nekot_htua", authToken)` without `HttpOnly`, `Secure`, or `SameSite`.
- Expected: server-side token storage plus opaque session cookie with hardened flags.
- Impact: XSS or script compromise can recover the bearer token from the JWT payload.

### R3 - Official starter proxy masks upstream status and headers

- Severity: High
- Evidence: `routes/graphql.js` calls upstream API then returns `res.json(await response.json())`; it does not forward upstream HTTP status, `x-rate-limit-*`, or 401/429 semantics.
- Expected: proxy should preserve status and important headers.
- Impact: developers copying the starter cannot observe auth/rate-limit failures accurately.

### R4 - Official sample dependency stack is severely stale

- Severity: High
- Evidence: public manifests pin old `jsonwebtoken`, `isomorphic-fetch`/`node-fetch`, `react-scripts 2.1.8`, React 16, and old tooling. Temporary audit from public manifests found high/critical vulnerabilities.
- Expected: maintained Node LTS stack, modern dependencies, lockfiles, Dependabot, and documented audit posture.
- Impact: supply-chain and onboarding risk in official sample code.

### R5 - Official sample defaults request `public private` scopes

- Severity: Medium
- Evidence: `.env.sample` defaults requested scopes to `public private`.
- Expected: least-privilege default should be `public`; private/write scopes should be opt-in with rationale.
- Impact: developers may over-request access by default.

### R6 - Official repo lacks an obvious vulnerability disclosure path

- Severity: Low/Medium
- Evidence: no `SECURITY.md` found in the official repo; `.well-known/security.txt` was unavailable/challenged/missing in public checks.
- Expected: clear disclosure contact for an API/security-first product.
- Impact: researchers and developers have no obvious responsible disclosure route.

## Responsible Negatives

- Reflected XSS in search query: a basic script payload was blocked by Cloudflare/WAF.
- Invalid product slug: Product Hunt returns a controlled 404.
- Deep GraphQL nesting: blocked by depth and max-complexity controls.
- Cloudflare challenge behavior is treated as one route/discovery policy issue, not counted as many separate bugs.

## Credential Hygiene

The developer token and API secret were provided for this assessment. They are long-lived and should be regenerated after submission. The repo never stores them; tests read `PH_API_TOKEN` from `.env` or CI secrets only.
