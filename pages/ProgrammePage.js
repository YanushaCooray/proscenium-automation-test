// @ts-check
const { expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class ProgrammePage {
  constructor(page) {
    this.page = page;
    // Real selectors from programme/page.jsx
    this.heading       = page.locator('h1', { hasText: 'Choose Your Next Performance' });
    this.eventCards    = page.locator('article');
    this.firstEventBtn = page.locator('a[href*="event-details"]').first();
    this.navProgramme  = page.locator('a[href="/programme"]').first();
    this.navBookings   = page.locator('a[href="/my-bookings"]').first();
    this.navLoyalty    = page.locator('a[href="/loyalty"]').first();
    this.logoLink      = page.locator('a', { hasText: 'THE PROSCENIUM' }).first();
    this.errorMessage  = page.locator('p.text-red-600');
    this.loadingText   = page.locator('p', { hasText: 'Loading Programme' });
    this.noEventsText  = page.locator('h2', { hasText: 'No Performances Available' });
  }

  async navigate() {
    await this.page.goto(`${BASE_URL}/programme`);
    await this.page.waitForLoadState('networkidle');
  }

  async assertPageLoaded() {
    await expect(this.page).toHaveURL(/\/programme/);
    // Wait for loading to finish
    await this.loadingText.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  }

  async assertHasEvents() {
    await this.assertPageLoaded();
    await expect(this.eventCards.first()).toBeVisible({ timeout: 15_000 });
  }

  async clickFirstEvent() {
    await expect(this.firstEventBtn).toBeVisible({ timeout: 10_000 });
    const href = await this.firstEventBtn.getAttribute('href');
    await this.firstEventBtn.click();
    return href; // returns the slug
  }

  async getFirstEventSlug() {
    await this.assertHasEvents();
    const href = await this.firstEventBtn.getAttribute('href');
    // href = /event-details?slug=xxx
    const match = href?.match(/slug=([^&]+)/);
    return match ? match[1] : null;
  }
}

module.exports = { ProgrammePage };
