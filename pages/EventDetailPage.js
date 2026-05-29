// @ts-check
const { expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class EventDetailPage {
  constructor(page) {
    this.page = page;
    // Real selectors from event-details/page.jsx
    // Date chips: button with CalendarIcon + date text
    this.dateChips       = page.locator('button.bg-\\[\\#e2e6eb\\], button.bg-\\[\\#0647c7\\]').filter({ hasText: /\d{2}/ });
    // Time chips
    this.timeChips       = page.locator('button').filter({ hasText: /\d{2}:\d{2}/ });
    // "Select Seats" button in the right sidebar
    this.selectSeatsBtn  = page.locator('button', { hasText: 'Select Seats' });
    // Price shown in sidebar
    this.priceDisplay    = page.locator('h2').filter({ hasText: /£/ }).first();
    // Availability
    this.availability    = page.locator('span', { hasText: /Seats Left/ });
    // Event title (h1)
    this.eventTitle      = page.locator('h1').first();
    // Loading state
    this.loadingText     = page.locator('p', { hasText: 'Loading Event' });
    // Error
    this.errorBanner     = page.locator('div.text-red-600');
  }

  async navigate(slug) {
    await this.page.goto(`${BASE_URL}/event-details?slug=${slug}`);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  }

  async assertPageLoaded() {
    await expect(this.page).toHaveURL(/\/event-details/);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await expect(this.eventTitle).toBeVisible({ timeout: 15_000 });
  }

  async selectFirstDate() {
    const firstDate = this.dateChips.first();
    if (await firstDate.isVisible({ timeout: 5_000 })) {
      await firstDate.click();
    }
  }

  async selectFirstTime() {
    const firstTime = this.timeChips.first();
    if (await firstTime.isVisible({ timeout: 5_000 })) {
      await firstTime.click();
    }
  }

  async clickSelectSeats() {
    await expect(this.selectSeatsBtn).toBeVisible({ timeout: 10_000 });
    await this.selectSeatsBtn.click();
  }
}

module.exports = { EventDetailPage };
