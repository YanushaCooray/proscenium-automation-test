// @ts-check
const { expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class SeatSelectionPage {
  constructor(page) {
    this.page = page;
    // Real selectors from seat-selection/page.jsx
    this.heading          = page.locator('p', { hasText: 'Seat Selection' });
    this.timerDisplay     = page.locator('p', { hasText: /\d{2}:\d{2}/ }).first();
    this.continueBtn      = page.locator('button', { hasText: 'Continue to Review' });
    this.summaryHeading   = page.locator('h2', { hasText: 'Booking Summary' });
    this.loadingText      = page.locator('p', { hasText: 'Loading Seat Selection' });
    this.errorBanner      = page.locator('div.text-red-600');
    this.lockingMsg       = page.locator('div.text-\\[\\#0647c7\\]', { hasText: 'Locking selected seat' });
    // Age modal (appears after clicking a seat)
    this.ageModal         = page.locator('h1', { hasText: 'Confirm Eligibility' });
    this.applyAgeBtn      = page.locator('button', { hasText: 'Apply & Select Seat' });
    this.cancelAgeBtn     = page.locator('button', { hasText: 'Cancel' });
    // Seats in the map — rendered by TheatreSeatMap component
    this.availableSeats   = page.locator('[data-testid="seat-available"], [data-status="available"]');
    // Fallback: any clickable seat element (TheatreSeatMap uses rect/path elements or divs)
    this.seatMapContainer = page.locator('div').filter({ hasText: 'Booking Summary' }).nth(0);
  }

  async assertPageLoaded() {
    await expect(this.page).toHaveURL(/\/seat-selection/);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await expect(this.summaryHeading).toBeVisible({ timeout: 15_000 });
  }

  async waitForLockingToFinish() {
    // Wait for the "Locking selected seat" message to disappear
    try {
      await this.lockingMsg.waitFor({ state: 'visible', timeout: 3_000 });
      await this.lockingMsg.waitFor({ state: 'hidden', timeout: 10_000 });
    } catch {
      // message never appeared — that's fine
    }
  }

  async confirmAgeIfModalAppears() {
    try {
      await this.ageModal.waitFor({ state: 'visible', timeout: 5_000 });
      // Select "Standard" (first option) and apply
      await this.applyAgeBtn.click();
    } catch {
      // modal didn't appear
    }
  }

  async clickContinue() {
    await expect(this.continueBtn).toBeEnabled({ timeout: 10_000 });
    await this.continueBtn.click();
  }

  async assertTimerVisible() {
    await expect(this.timerDisplay).toBeVisible();
  }
}

module.exports = { SeatSelectionPage };
