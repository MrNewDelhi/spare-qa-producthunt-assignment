# Product Hunt QA Strategy

**Context.** Product Hunt is a public, API-first product with live data, third-party auth, SEO-sensitive discovery pages, and a GraphQL API used by external developers. As sole QA, I would focus on failures that harm trust: broken core read journeys, API contract drift, auth/token handling, and noisy production errors.

**Risk priorities.**
1. **API contract and security posture:** auth errors, scope boundaries, pagination correctness, schema discoverability, rate-limit/complexity enforcement, and official sample-code safety. The API is a developer product, so unclear contracts become customer bugs.
2. **Core anonymous web flows:** home feed, search, pagination, product detail, public navigation, and error states. These are high-traffic and do not require risky account actions.
3. **Accessibility, SEO, and observability:** public search/newsletter/sponsor pages should expose correct link/heading semantics, avoid misleading alt text, and remain free from client-side error noise.

**Test approach.** Keep a typed API suite as the lower-level backbone because GraphQL contracts are stable enough to automate and cheap to run. Add focused Playwright E2E for critical anonymous journeys, using role and structural assertions rather than volatile product names. Manual exploratory testing covers edge pages, a11y/SEO checks, and security probes that should not be automated aggressively.

**Data and ethics.** All tests are read-only. No mutations, scraping loops, stress tests, token brute force, or attempts to access private user data. Token-gated tests use a developer token from `PH_API_TOKEN`; unauthenticated contract tests run without secrets.

**CI policy.** `bun test tests/api` for API tests, `bun run test:e2e` for Playwright under Node, Chromium only for speed, traces/screenshots on failure, no hard waits. Token-required tests skip gracefully when `PH_API_TOKEN` is absent.

**Known limits.** I did not test authenticated write flows, payments/ads purchase flows, production load, or full cross-browser/visual regression. With more time I would add sandbox OAuth accounts, GraphQL codegen contract snapshots, axe accessibility scans, synthetic monitoring, and a safe staging environment for mutation tests.
