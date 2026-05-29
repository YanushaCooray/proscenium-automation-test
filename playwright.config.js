// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ path: `.env.${process.env.TEST_ENV || 'dev'}` });

module.exports = defineConfig({
  testDir: './tests',

  // ── Global ─────────────────────────────────────────────────────────────────
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  // ── Reporters ──────────────────────────────────────────────────────────────
  // allure-playwright always runs — results land in allure-results/.
  // npm scripts clear allure-results/ before each run and generate the
  // HTML report afterward, so every run starts fresh.
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', {
      detail: true,
      outputFolder: 'allure-results',
      suiteTitle: true,
      environmentInfo: {
        app: 'Proscenium V2',
        env: process.env.TEST_ENV || 'dev',
        base_url: process.env.BASE_URL || 'http://localhost:3000',
      },
    }],
  ],

  // ── Shared browser settings ────────────────────────────────────────────────
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
  },

  // ── Projects ───────────────────────────────────────────────────────────────
  projects: [
    // 1. Setup — runs first, creates all auth session files
    {
      name: 'setup',
      testMatch: '**/fixtures/global.setup.js',
    },

    // 2. BVT — Chromium only, fast smoke checks on every commit
    {
      name: 'bvt',
      grep: /@bvt/,
      testDir: './tests/e2e/bvt',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/fixtures/.auth/customer.json',
      },
    },

    // 3. Regression — Chromium
    {
      name: 'regression-chromium',
      grep: /@regression/,
      testDir: './tests/e2e/regression',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/fixtures/.auth/customer.json',
      },
    },

    // 4. Regression — Firefox
    {
      name: 'regression-firefox',
      grep: /@regression/,
      testDir: './tests/e2e/regression',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/fixtures/.auth/customer.json',
      },
    },
  ],

  outputDir: 'test-results',
});
