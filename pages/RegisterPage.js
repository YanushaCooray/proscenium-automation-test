// @ts-check
const { expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class RegisterPage {
  constructor(page) {
    this.page = page;
    // Real selectors from register/page.jsx
    this.fullNameInput        = page.locator('input[name="fullName"]');
    this.emailInput           = page.locator('input[name="email"]');
    this.passwordInput        = page.locator('input[name="password"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.joinLoyaltyCheckbox  = page.locator('input[name="joinLoyalty"]');
    this.submitButton         = page.locator('button[type="submit"]');
    this.errorMessage         = page.locator('p.text-red-600');
    this.loginLink            = page.locator('a[href="/login"]');
  }

  async navigate() {
    await this.page.goto(`${BASE_URL}/register`);
    await this.fullNameInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * @param {{ fullName: string, email: string, password: string, joinLoyalty?: boolean }} data
   */
  async fillForm({ fullName, email, password, joinLoyalty = false }) {
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    if (joinLoyalty) {
      await this.joinLoyaltyCheckbox.check();
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async assertError(message) {
    await expect(this.errorMessage).toBeVisible({ timeout: 8_000 });
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }
}

module.exports = { RegisterPage };
