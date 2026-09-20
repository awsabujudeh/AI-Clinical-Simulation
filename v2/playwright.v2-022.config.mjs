import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser/v2-022-e2e", workers: 1, timeout: 180000,
  expect: { timeout: 30000 },
  outputDir: "test-results/v2-022",
  use: { baseURL: "http://127.0.0.1:4190", browserName: "chromium",
    channel: process.platform === "win32" ? "msedge" : undefined, headless: true,
    viewport: { width: 1600, height: 1080 }, launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure" },
  webServer: { command: "node scripts/v2-022-review-host.mjs", url: "http://127.0.0.1:4190/__review/session", reuseExistingServer: false, timeout: 120000 }
});
