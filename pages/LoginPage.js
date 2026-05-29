// @ts-check
const { expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class LoginPage {
  constructor(page) {
    this.page = page;
    // Real selectors from login/page.jsx
    this.emailInput     = page.locator('input[name="email"]');
    this.passwordInput  = page.locator('input[name="password"]');
    this.submitButton   = page.locator('button[type="submit"]');
    this.errorMessage   = page.locator('p.text-red-600');
    this.forgotPassword = page.locator('button', { hasText: 'Forgot Password?' });
    this.registerLink   = page.locator('a[href="/register"]').first();
    // 2FA step
    this.verifyInput    = page.locator('input[maxlength="6"]');
    this.verifyButton   = page.locator('button', { hasText: 'Verify and Continue' });
  }

  async goto() {
    await this.page.goto(`${BASE_URL}/login`);
    await this.emailInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async login(email, password) {
    await this.goto();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async assertOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.submitButton).toBeVisible();
  }

  async assertError() {
    await expect(this.errorMessage).toBeVisible({ timeout: 8_000 });
  }

  async assertLoggedOut() {
    await expect(this.page).toHaveURL(/\/login/);
  }
}

module.exports = { LoginPage };
