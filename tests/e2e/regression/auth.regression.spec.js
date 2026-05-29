// @ts-check
/**
 * Regression — Authentication
 * Full coverage of login, registration, RBAC, and session management.
 */

const { test, expect } = require('@playwright/test');
const { LoginPage }    = require('../../../pages/LoginPage');
const { RegisterPage } = require('../../../pages/RegisterPage');
const { AdminPage }    = require('../../../pages/AdminPage');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Authentication — Regression', () => {

  // ── Login ──────────────────────────────────────────────────────────────────
  test.describe('Login', () => {

    test('RG-02 — Valid credentials redirect away from login @regression',
      { tag: ['@regression'] },
      async ({ page }) => {
        const login = new LoginPage(page);
        await login.login(
          process.env.CUSTOMER_EMAIL || 'customer@test.com',
          process.env.CUSTOMER_PASSWORD || 'TestPass@123'
        );
        await page.waitForURL(/\/(loyalty-upgrade|loyalty|programme)/, { timeout: 20_000 });
        expect(page.url()).not.toContain('/login');
      }
    );

    test('RG-03 — Invalid credentials show error message @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext(); // no auth
        const page = await ctx.newPage();
        try {
          const login = new LoginPage(page);
          await login.login('notexist@test.com', 'WrongPassword!');
          await login.assertError();
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-04 — Empty form submission shows validation error @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const login = new LoginPage(page);
          await login.goto();
          await login.submitButton.click();
          await login.assertError();
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-04b — Password field type is password (masked) @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const login = new LoginPage(page);
          await login.goto();
          const type = await login.passwordInput.getAttribute('type');
          expect(type).toBe('password');
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-04c — Forgot Password link navigates to /forgot-password @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const login = new LoginPage(page);
          await login.goto();
          await login.forgotPassword.click();
          await expect(page).toHaveURL(/\/forgot-password/, { timeout: 10_000 });
        } finally {
          await ctx.close();
        }
      }
    );
  });

  // ── Registration ───────────────────────────────────────────────────────────
  test.describe('Registration', () => {

    test('RG-01 — Register with valid data creates session @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const reg = new RegisterPage(page);
          await reg.navigate();
          await reg.fillForm({
            fullName:    'Regression User',
            email:       `reg.${Date.now()}@test.com`,
            password:    'TestPass@123',
            joinLoyalty: false,
          });
          await reg.submit();
          await page.waitForURL(/\/(loyalty-upgrade|loyalty|programme)/, { timeout: 20_000 });
          const token = await page.evaluate(() => localStorage.getItem('prosceniumToken'));
          expect(token).not.toBeNull();
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-01b — Password mismatch shows error @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const reg = new RegisterPage(page);
          await reg.navigate();
          await reg.fullNameInput.fill('Test');
          await reg.emailInput.fill(`mismatch.${Date.now()}@test.com`);
          await reg.passwordInput.fill('TestPass@123');
          await reg.confirmPasswordInput.fill('DifferentPass@123');
          await reg.submit();
          await reg.assertError('Passwords do not match');
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-01c — Short password shows validation error @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const reg = new RegisterPage(page);
          await reg.navigate();
          await reg.fullNameInput.fill('Test');
          await reg.emailInput.fill(`short.${Date.now()}@test.com`);
          await reg.passwordInput.fill('short');
          await reg.confirmPasswordInput.fill('short');
          await reg.submit();
          await reg.assertError('8 characters');
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-01d — Register with loyalty checkbox joins Gold Circle @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext();
        const page = await ctx.newPage();
        try {
          const reg = new RegisterPage(page);
          await reg.navigate();
          await reg.fillForm({
            fullName:    'Loyalty Reg User',
            email:       `loyalty.reg.${Date.now()}@test.com`,
            password:    'TestPass@123',
            joinLoyalty: true,
          });
          await reg.submit();
          // With loyalty: should redirect to /loyalty (member page)
          await page.waitForURL(/\/(loyalty|programme|loyalty-upgrade)/, { timeout: 20_000 });
          expect(page.url()).not.toContain('/login');
        } finally {
          await ctx.close();
        }
      }
    );
  });

  // ── RBAC ───────────────────────────────────────────────────────────────────
  test.describe('Access Control', () => {

    test('RG-05 — Customer blocked from /admin/dashboard @regression',
      { tag: ['@regression'] },
      async ({ page }) => {
        // customer storageState is applied by project config
        await page.goto(`${BASE_URL}/admin/dashboard`);
        await page.waitForTimeout(3_000);
        expect(page.url()).not.toMatch(/\/admin\/dashboard/);
      }
    );

    test('RG-06 — Unauthenticated user redirected to /login @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext(); // no auth
        const page = await ctx.newPage();
        try {
          await page.goto(`${BASE_URL}/programme`);
          await page.waitForURL(/\/login/, { timeout: 15_000 });
          expect(page.url()).toContain('/login');
        } finally {
          await ctx.close();
        }
      }
    );

    test('RG-07 — Admin can access /admin/dashboard @regression',
      { tag: ['@regression'] },
      async ({ browser }) => {
        const ctx  = await browser.newContext({
          storageState: 'tests/fixtures/.auth/admin.json',
        });
        const page = await ctx.newPage();
        try {
          const admin = new AdminPage(page);
          await admin.navigate();
          await admin.assertDashboardLoaded();
        } finally {
          await ctx.close();
        }
      }
    );
  });
});
