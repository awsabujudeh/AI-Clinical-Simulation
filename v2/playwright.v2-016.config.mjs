import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser/v2-016-e2e",
  testMatch: "clinical-actions.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174/tests/browser/v2-016-e2e/action-harness.html",
    reuseExistingServer: false,
    timeout: 120000
  }
});
