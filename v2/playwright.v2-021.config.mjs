import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser/v2-021-e2e", testMatch: "*.spec.ts", workers: 1, timeout: 240000,
  expect: { timeout: 30000 },
  use: { baseURL: "http://127.0.0.1:4186", browserName: "chromium", channel: process.platform === "win32" ? "msedge" : undefined, headless: true,
    viewport: { width: 1600, height: 1080 }, launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    video: { mode: "on", size: { width: 1600, height: 1080 } }, screenshot: "only-on-failure" },
  webServer: { command: "node scripts/v2-021-review-host.mjs", url: "http://127.0.0.1:4186/__review/session", reuseExistingServer: true, timeout: 120000 }
});
