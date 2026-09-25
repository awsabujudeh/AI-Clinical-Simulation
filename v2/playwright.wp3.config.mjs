import base from './playwright.wp2.config.mjs';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,use:{...base.use,actionTimeout:15000},testDir:'tests/browser/wp3-e2e',outputDir:'test-results/wp3-app',timeout:240000});
