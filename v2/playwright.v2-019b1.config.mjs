import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser/v2-019b1-e2e",
  testMatch: "clinical-interpreter.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4178",
    headless: true
  },
  webServer: {
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4178 --strictPort",
    url: "http://127.0.0.1:4178/tests/browser/v2-019b1-e2e/clinical-interpreter-harness.html",
    reuseExistingServer: false,
    timeout: 120000
  }
});
