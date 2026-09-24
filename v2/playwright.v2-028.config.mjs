import { defineConfig } from '@playwright/test';
// Opt-in only for task-owned hosts started explicitly during local diagnostics.
const reuseExistingServer = process.env.V2_028_REUSE_TEST_HOSTS === '1';
export default defineConfig({ testDir: 'tests/browser/v2-028-e2e', outputDir: 'test-results/v2-028-playwright', workers: 1, timeout: 60000,
  use: { headless: true, viewport: { width: 1440, height: 1040 } },
  webServer: [
    { command: 'node scripts/v2-028-preflight-host.mjs', url: 'http://127.0.0.1:4200/expo/preflight', reuseExistingServer, timeout: 90000 },
    { command: 'node tests/browser/v2-028-e2e/fixture-host.mjs', url: 'http://127.0.0.1:4201/expo/preflight', reuseExistingServer, timeout: 90000 }
  ]
});
