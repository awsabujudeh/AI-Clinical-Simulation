import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "tests/browser/v2-025-e2e", workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4193", headless: true, viewport: { width: 1440, height: 1000 } },
  webServer: { command: "node scripts/v2-025-faculty-host.mjs", url: "http://127.0.0.1:4193/__faculty/cases", reuseExistingServer: false, timeout: 90000 }
});
