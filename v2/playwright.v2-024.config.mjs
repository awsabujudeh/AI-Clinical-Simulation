import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser/v2-024-e2e", workers: 1, timeout: 90000,
  use: { baseURL: "http://127.0.0.1:4192", browserName: "chromium", headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: "node scripts/v2-024-review-host.mjs", url: "http://127.0.0.1:4192/__review/session", reuseExistingServer: false,
    env: { V2_024_TEST_TUTOR: "1", V2_ALLOW_LIVE_V2_024_TUTOR: "0" }, timeout: 90000 }
});
