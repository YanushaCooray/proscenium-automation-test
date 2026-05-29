// @ts-check
const { expect } = require('@playwright/test');

class ReviewSelectionPage {
  constructor(page) {
    this.page = page;
    // Real selectors from review-selection/page.jsx
    this.heading       = page.locator('h1', { hasText: 'Review Your' });
    this.confirmBtn    = page.locator('button', { hasText: 'Confirm Booking' });
    this.timerDisplay  = page.locator('span', { hasText: /\d{2}:\d{2}/ }).first();
    this.totalAmount   = page.locator('p', { hasText: 'Total Amount' });
    this.totalValue    = page.locator('p.text-\\[\\#0647c7\\]').filter({ hasText: /£/ }).first();
    this.loadingText   = page.locator('p', { hasText: 'Loading Review' });
    this.errorBanner   = page.locator('div.text-red-600');
    this.lockValidMsg  = page.locator('p.text-green-700', { hasText: 'reserved under your account' });
    this.seatsSection  = page.locator('h2', { hasText: 'Selected Seats' });
    this.benefitsSection = page.locator('h2', { hasText: 'Eligible Benefits' });
  }

  async assertPageLoaded() {
    await expect(this.page).toHaveURL(/\/review-selection/);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async assertSeatsVisible() {
    await expect(this.seatsSection).toBeVisible({ timeout: 10_000 });
  }

  async confirmBooking() {
    await expect(this.confirmBtn).toBeEnabled({ timeout: 15_000 });
    await this.confirmBtn.click();
  }
}

class BookingSuccessPage {
  constructor(page) {
    this.page = page;
    // Real selectors from booking-success/page.jsx
    this.successHeading    = page.locator('h1', { hasText: "Bravo! You're all set." });
    this.bookingRefLabel   = page.locator('p', { hasText: 'Booking Reference' });
    this.bookingRefValue   = page.locator('p.text-\\[\\#171c24\\]').filter({ hasText: /[A-Z0-9]{6,}/ }).first();
    this.downloadBtn       = page.locator('button', { hasText: 'Download Digital Ticket' });
    this.viewBookingsLink  = page.locator('a', { hasText: 'View My Bookings' });
    this.backToProgramme   = page.locator('a', { hasText: 'Back to Programme' });
    this.loadingText       = page.locator('p', { hasText: 'Loading Booking' });
    this.eventTitle        = page.locator('h2').first(); // inside CurtainHeader
    this.totalPaidLabel    = page.locator('p', { hasText: 'Total Paid' });
  }

  async assertPageLoaded() {
    await expect(this.page).toHaveURL(/\/booking-success/);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await expect(this.successHeading).toBeVisible({ timeout: 15_000 });
  }

  async assertBookingReferenceVisible() {
    await expect(this.bookingRefLabel).toBeVisible({ timeout: 10_000 });
  }

  async getBookingReference() {
    // bookingRef is in the URL: /booking-success?bookingRef=XXX
    const url = this.page.url();
    const match = url.match(/bookingRef=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

module.exports = { ReviewSelectionPage, BookingSuccessPage };
