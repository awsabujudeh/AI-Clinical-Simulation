import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser/v2-020a-e2e", testMatch: "voice.spec.ts", workers: 1,
  retries: 0, reporter: "line", use: { baseURL: "http://127.0.0.1:4181", headless: true },
  webServer: { command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4181 --strictPort",
    url: "http://127.0.0.1:4181/tests/browser/v2-020a-e2e/voice-harness.html", reuseExistingServer: false, timeout: 120000 }
});
