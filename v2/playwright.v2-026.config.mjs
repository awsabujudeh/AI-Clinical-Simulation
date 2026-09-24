import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"tests/browser",testMatch:["v2-026-e2e/*.spec.ts","v2-021-e2e/runtime.spec.ts"],workers:1,timeout:120000,expect:{timeout:30000},outputDir:"test-results/v2-026-app",
  use:{baseURL:"http://127.0.0.1:4194",browserName:"chromium",channel:process.platform==="win32"?"msedge":undefined,headless:true,
    viewport:{width:1600,height:1080},launchOptions:{args:["--enable-unsafe-swiftshader"]},screenshot:"only-on-failure"},
  webServer:{command:"node scripts/v2-026-review-host.mjs",url:"http://127.0.0.1:4194/__review/session",reuseExistingServer:false,timeout:90000}
});
