// @ts-check
const { test: setup } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join('tests', 'fixtures', '.auth');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

setup.beforeAll(() => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
});

/**
 * Login helper — uses the real Proscenium login form:
 *   - Email field: input[name="email"]
 *   - Password field: input[name="password"]
 *   - Submit: button[type="submit"] "Sign In"
 *
 * After login the app redirects to /loyalty-upgrade, /loyalty or /programme.
 * Admin redirects to /admin/dashboard.
 */
async function loginAndSave(page, email, password, authFile, waitForUrl) {
  await page.goto(`${BASE_URL}/login`);

  // Wait for the login form to be ready
  await page.waitForSelector('input[name="email"]', { timeout: 15_000 });

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect away from /login
  await page.waitForURL(waitForUrl, { timeout: 20_000 });

  await page.context().storageState({ path: authFile });
  console.log(`✅ Saved: ${authFile}`);
}

// ─── Customer ─────────────────────────────────────────────────────────────
setup('save customer session', async ({ page }) => {
  await loginAndSave(
    page,
    process.env.CUSTOMER_EMAIL || 'customer@test.com',
    process.env.CUSTOMER_PASSWORD || 'TestPass@123',
    path.join(AUTH_DIR, 'customer.json'),
    /\/(loyalty-upgrade|loyalty|programme)/
  );
});

// ─── Loyalty member ───────────────────────────────────────────────────────
setup('save loyalty session', async ({ page }) => {
  await loginAndSave(
    page,
    process.env.LOYALTY_EMAIL || 'loyalty@test.com',
    process.env.LOYALTY_PASSWORD || 'TestPass@123',
    path.join(AUTH_DIR, 'loyalty.json'),
    /\/(loyalty-upgrade|loyalty|programme)/
  );
});

// ─── Admin ────────────────────────────────────────────────────────────────
setup('save admin session', async ({ page }) => {
  await loginAndSave(
    page,
    process.env.ADMIN_EMAIL || 'admin@proscenium.com',
    process.env.ADMIN_PASSWORD || 'Admin@12345',
    path.join(AUTH_DIR, 'admin.json'),
    /\/admin\/dashboard/
  );
});
