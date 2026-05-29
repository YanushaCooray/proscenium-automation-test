/**
 * booking-flow.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared, reusable flow steps for the Proscenium Theatre Booking System.
 * All K6 scripts (load, spike, stress, smoke) import helpers from here
 * so the endpoint logic is defined once.
 *
 * API base: http://localhost:5000/api  (override via K6_BASE_URL env var)
 *
 * Actual endpoints confirmed from backend routes:
 *   POST   /api/auth/login
 *   GET    /api/events
 *   GET    /api/seats/performance/:performanceId
 *   GET    /api/seat-locks/status/:performanceId
 *   POST   /api/seat-locks/lock
 *   PATCH  /api/seat-locks/refresh
 *   POST   /api/seat-locks/release
 *   POST   /api/bookings
 *   GET    /api/bookings/my-bookings
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

// ── Environment ────────────────────────────────────────────────────────────
export const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:5000/api";

// ── Custom metrics ─────────────────────────────────────────────────────────
export const bookingSuccessRate   = new Rate("booking_success_rate");
export const seatLockSuccessRate  = new Rate("seat_lock_success_rate");
export const seatConflictRate     = new Rate("seat_lock_conflict_rate");
export const bookingDuration      = new Trend("booking_flow_duration_ms");
export const loginDuration        = new Trend("login_duration_ms");
export const eventListDuration    = new Trend("event_list_duration_ms");
export const seatMapDuration      = new Trend("seat_map_duration_ms");
export const lockConflicts        = new Counter("seat_lock_conflicts_total");
export const bookingsCompleted    = new Counter("bookings_completed_total");

// ── Test users (loaded at init time — not in VU context) ───────────────────
export const TEST_USERS = new SharedArray("users", () => [
  { email: __ENV.CUSTOMER_EMAIL    || "customer@test.com",  password: __ENV.CUSTOMER_PASSWORD    || "TestPass@123" },
  { email: __ENV.LOYALTY_EMAIL     || "loyalty@test.com",   password: __ENV.LOYALTY_PASSWORD     || "TestPass@123" },
  { email: __ENV.CUSTOMER2_EMAIL   || "customer2@test.com", password: __ENV.CUSTOMER2_PASSWORD   || "TestPass@123" },
  { email: __ENV.CUSTOMER3_EMAIL   || "customer3@test.com", password: __ENV.CUSTOMER3_PASSWORD   || "TestPass@123" },
  { email: __ENV.CUSTOMER4_EMAIL   || "customer4@test.com", password: __ENV.CUSTOMER4_PASSWORD   || "TestPass@123" },
]);

// ── Seeded test data ───────────────────────────────────────────────────────
export const SEED = {
  eventId:       __ENV.TEST_EVENT_ID        || "EVENT_ID_FROM_SEED",
  performanceId: __ENV.TEST_PERFORMANCE_ID  || "PERFORMANCE_ID_FROM_SEED",
  seatId:        __ENV.TEST_SEAT_ID         || "SEAT_ID_FROM_SEED",
};

// ── JSON headers helper ────────────────────────────────────────────────────
export function jsonHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1: Login
// Returns JWT token string or null on failure
// ─────────────────────────────────────────────────────────────────────────────
export function login(email: string, password: string): string | null {
  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders(), tags: { flow: "auth", endpoint: "login" } }
  );

  loginDuration.add(Date.now() - start);

  const ok = check(res, {
    "login: status 200":        (r) => r.status === 200,
    "login: has token":         (r) => {
      try { return !!(r.json() as any).token; } catch { return false; }
    },
    "login: response time <1s": (r) => r.timings.duration < 1000,
  });

  if (!ok || res.status !== 200) return null;

  try {
    return (res.json() as any).token as string;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2: Browse events (40% traffic mix)
// ─────────────────────────────────────────────────────────────────────────────
export function browseEvents(token: string): void {
  const start = Date.now();

  const res = http.get(`${BASE_URL}/events`, {
    headers: jsonHeaders(token),
    tags: { flow: "browse", endpoint: "events" },
  });

  eventListDuration.add(Date.now() - start);

  check(res, {
    "browse events: status 200":        (r) => r.status === 200,
    "browse events: has array":         (r) => {
      try { return Array.isArray(r.json()); } catch { return false; }
    },
    "browse events: response time <1s": (r) => r.timings.duration < 1000,
  });

  sleep(Math.random() * 2 + 1); // 1–3s reading time
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3: View seat layout for a performance (30% traffic mix)
// ─────────────────────────────────────────────────────────────────────────────
export function viewSeatLayout(token: string, performanceId: string): void {
  const start = Date.now();

  // Get seat availability
  const seatsRes = http.get(
    `${BASE_URL}/seats/performance/${performanceId}`,
    { headers: jsonHeaders(token), tags: { flow: "seats", endpoint: "seat_map" } }
  );

  // Also get seat lock status (what users see — grey/green/red)
  const lockRes = http.get(
    `${BASE_URL}/seat-locks/status/${performanceId}`,
    { headers: jsonHeaders(token), tags: { flow: "seats", endpoint: "seat_lock_status" } }
  );

  seatMapDuration.add(Date.now() - start);

  check(seatsRes, {
    "seat map: status 200":        (r) => r.status === 200,
    "seat map: response time <1s": (r) => r.timings.duration < 1000,
  });

  check(lockRes, {
    "lock status: status 200":        (r) => r.status === 200,
    "lock status: response time <1s": (r) => r.timings.duration < 1000,
  });

  sleep(Math.random() * 3 + 2); // 2–5s browsing the seat map
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 4: Complete booking (30% traffic mix) — the most critical flow
// Steps: lock seat → confirm booking → release on failure
// ─────────────────────────────────────────────────────────────────────────────
export function completeBooking(
  token: string,
  performanceId: string,
  seatId: string
): boolean {
  const flowStart = Date.now();

  // ── Step 1: Lock the seat ────────────────────────────────────────────────
  const lockRes = http.post(
    `${BASE_URL}/seat-locks/lock`,
    JSON.stringify({ performanceId, seatIds: [seatId] }),
    { headers: jsonHeaders(token), tags: { flow: "booking", endpoint: "seat_lock" } }
  );

  const lockOk = check(lockRes, {
    "seat lock: status 200 or 201": (r) => r.status === 200 || r.status === 201,
    "seat lock: response time <500ms": (r) => r.timings.duration < 500,
  });

  if (!lockOk || (lockRes.status !== 200 && lockRes.status !== 201)) {
    // Seat was locked by another user — record the conflict
    if (lockRes.status === 409 || lockRes.status === 400) {
      lockConflicts.add(1);
      seatConflictRate.add(1);
    } else {
      seatConflictRate.add(0);
    }
    seatLockSuccessRate.add(0);
    return false;
  }

  seatLockSuccessRate.add(1);
  seatConflictRate.add(0);
  sleep(0.5); // Simulate user reviewing seat before confirming

  // ── Step 2: Create booking ───────────────────────────────────────────────
  const bookingPayload = {
    performanceId,
    seats: [
      {
        seatId,
        ageGroup: "adult",
        originalPrice: 50,
        finalPrice: 50,
        discountApplied: 0,
      },
    ],
    totalAmount:    50,
    discountAmount: 0,
    discountType:   null,
  };

  const bookRes = http.post(
    `${BASE_URL}/bookings`,
    JSON.stringify(bookingPayload),
    { headers: jsonHeaders(token), tags: { flow: "booking", endpoint: "create_booking" } }
  );

  const bookOk = check(bookRes, {
    "booking: status 200 or 201":   (r) => r.status === 200 || r.status === 201,
    "booking: has bookingRef":      (r) => {
      try { return !!(r.json() as any).bookingRef; } catch { return false; }
    },
    "booking: response time <1.5s": (r) => r.timings.duration < 1500,
  });

  bookingDuration.add(Date.now() - flowStart);

  if (bookOk) {
    bookingSuccessRate.add(1);
    bookingsCompleted.add(1);
    return true;
  }

  // Booking failed — release the lock
  bookingSuccessRate.add(0);
  http.post(
    `${BASE_URL}/seat-locks/release`,
    JSON.stringify({ performanceId, seatIds: [seatId] }),
    { headers: jsonHeaders(token), tags: { flow: "booking", endpoint: "release_lock" } }
  );
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 5: Refresh seat lock (keeps lock alive during selection)
// ─────────────────────────────────────────────────────────────────────────────
export function refreshSeatLock(
  token: string,
  performanceId: string,
  seatIds: string[]
): void {
  const res = http.patch(
    `${BASE_URL}/seat-locks/refresh`,
    JSON.stringify({ performanceId, seatIds }),
    { headers: jsonHeaders(token), tags: { flow: "booking", endpoint: "refresh_lock" } }
  );

  check(res, {
    "lock refresh: status 200": (r) => r.status === 200,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 6: View my bookings (used in load test)
// ─────────────────────────────────────────────────────────────────────────────
export function viewMyBookings(token: string): void {
  const res = http.get(`${BASE_URL}/bookings/my-bookings`, {
    headers: jsonHeaders(token),
    tags: { flow: "account", endpoint: "my_bookings" },
  });

  check(res, {
    "my bookings: status 200":        (r) => r.status === 200,
    "my bookings: response time <1s": (r) => r.timings.duration < 1000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Pick a random user from the shared array
// ─────────────────────────────────────────────────────────────────────────────
export function randomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}
