import { defineConfig, devices, type ReporterDescription } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// Sanctioned, owner-side bypass for bot-gated environments (NOT evasion):
// when you own the WAF you allow your own tests via a skip rule keyed on a
// secret header, or point tests at a non-bot-gated staging URL.
// e.g. PH_CF_BYPASS_HEADER="x-waf-bypass: <secret>"
function parseBypassHeader(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const idx = raw.indexOf(":");
  if (idx < 1) return undefined;
  const name = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  return name && value ? { [name]: value } : undefined;
}
const extraHTTPHeaders = parseBypassHeader(process.env.PH_CF_BYPASS_HEADER);

// Native reporting (researched against playwright.dev for 1.61):
// - local: `list` (with step titles) + interactive HTML opened on failure
// - CI: `list` + GitHub annotations + JUnit (dashboards) + blob (mergeable for sharding)
const reporter: ReporterDescription[] = isCI
  ? [
      ["list", { printSteps: true }],
      ["github"],
      ["junit", { outputFile: "test-results/junit.xml" }],
      ["blob"]
    ]
  : [
      ["list", { printSteps: true }],
      ["html", { open: "on-failure" }]
    ];

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter,
  use: {
    baseURL: process.env.PH_WEB_BASE_URL ?? "https://www.producthunt.com",
    // Cloudflare bot-management 403s headless browsers on the live prod site,
    // so default to headed locally (real coverage + demo). CI runs headless and
    // the BasePage Cloudflare guard skips-with-reason rather than going red.
    // Override with PW_HEADLESS=1 (force headless) / PW_HEADLESS=0 (force headed).
    headless: process.env.PW_HEADLESS ? process.env.PW_HEADLESS === "1" : Boolean(process.env.CI),
    ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    // Traces/screenshots/video auto-attach to the HTML report for triage.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    testIdAttribute: "data-test"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile project for responsive smoke; opt-in via --project=mobile-chrome.
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } }
  ]
});
