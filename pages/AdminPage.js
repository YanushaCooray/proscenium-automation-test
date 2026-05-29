// @ts-check
const { expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class AdminPage {
  constructor(page) {
    this.page = page;
    // Real selectors from admin/dashboard/page.jsx
    this.dashboardHeading  = page.locator('h1', { hasText: 'Dashboard Overview' });
    this.totalBookingsStat = page.locator('p', { hasText: 'Total Bookings' });
    this.revenueStat       = page.locator('p', { hasText: 'Revenue' });
    this.loadingText       = page.locator('p', { hasText: 'Loading Dashboard' });
    this.errorBanner       = page.locator('div.text-red-600');
    this.recentBookings    = page.locator('h2', { hasText: 'Recent Bookings' });
    this.revenueChart      = page.locator('h2', { hasText: 'Revenue Trend' });
    // Sidebar nav items (AdminSidebar)
    this.sidebarDashboard  = page.locator('a[href="/admin/dashboard"]');
    this.sidebarEvents     = page.locator('a[href="/admin/events"]');
    this.sidebarUsers      = page.locator('a[href="/admin/users"]');
  }

  async navigate() {
    await this.page.goto(`${BASE_URL}/admin/dashboard`);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  }

  async assertDashboardLoaded() {
    await expect(this.page).toHaveURL(/\/admin\/dashboard/);
    await this.loadingText.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
    await expect(this.dashboardHeading).toBeVisible({ timeout: 15_000 });
  }

  async assertStatsVisible() {
    await expect(this.totalBookingsStat).toBeVisible();
    await expect(this.revenueStat).toBeVisible();
  }
}

module.exports = { AdminPage };
