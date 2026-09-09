import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser/v2-019a-e2e",
  testMatch: "patient-conversation.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4177",
    headless: true
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4177 --strictPort",
    url: "http://127.0.0.1:4177/tests/browser/v2-019a-e2e/patient-conversation-harness.html",
    reuseExistingServer: false,
    timeout: 120000
  }
});
