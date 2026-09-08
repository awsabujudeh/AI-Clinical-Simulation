import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser/v2-017-e2e",
  testMatch: "monitor-assessment.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4175",
    headless: true
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175/tests/browser/v2-017-e2e/monitor-assessment-harness.html",
    reuseExistingServer: false,
    timeout: 120000
  }
});
