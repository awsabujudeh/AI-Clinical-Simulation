import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser/wp1-e2e",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 30000 },
  outputDir: "test-results/wp1-app",
  use: {
    browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    viewport: { width: 1500, height: 1000 },
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure",
  },
  webServer: [{
    command: "node scripts/wp1-review-host.mjs",
    url: "http://127.0.0.1:4214/__review/session",
    timeout: 90000,
    reuseExistingServer: false,
  }, {
    command: "node scripts/wp1-review-host.mjs --patient=dana",
    url: "http://127.0.0.1:4215/__review/session",
    timeout: 90000,
    reuseExistingServer: false,
  }],
});
