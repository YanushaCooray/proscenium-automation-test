/**
 * smoke-test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Smoke test — 1–3 VUs, ~2 minutes.
 *
 * PURPOSE
 * Confirms the system is up and all critical endpoints respond correctly
 * BEFORE running the heavy load, spike, or stress tests.
 * If smoke fails → abort immediately, no point burning VUs on a broken system.
 *
 * WHEN TO RUN
 *   - Before every performance test session
 *   - After any deployment to the test environment
 *   - As a quick API health check in CI
 *
 * PASS CRITERIA
 *   - 0 errors
 *   - p95 < 800 ms (the tightest SLA target)
 *   - All critical checks pass
 *
 * RUN COMMAND
 *   k6 run smoke-test.ts \
 *     -e K6_BASE_URL=http://localhost:5000/api \
 *     -e CUSTOMER_EMAIL=customer@test.com \
 *     -e CUSTOMER_PASSWORD=TestPass@123 \
 *     -e TEST_PERFORMANCE_ID=<id> \
 *     -e TEST_SEAT_ID=<id>
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Options } from "k6/options";
import {
  BASE_URL,
  login,
  browseEvents,
  viewSeatLayout,
  jsonHeaders,
  SEED,
} from "./shared/booking-flow";
import { smokeThresholds } from "./shared/thresholds";

// ── Options ───────────────────────────────────────────────────────────────────
export const options: Options = {
  vus:      2,
  duration: "2m",

  thresholds: {
    ...smokeThresholds,

    // Every single check must pass in smoke
    checks: ["rate==1.00"],
  },

  tags: { test_type: "smoke" },
};

// ── VU script ─────────────────────────────────────────────────────────────────
export default function () {
  const email    = __ENV.CUSTOMER_EMAIL    || "customer@test.com";
  const password = __ENV.CUSTOMER_PASSWORD || "TestPass@123";

  // ── 1. Authentication ─────────────────────────────────────────────────────
  group("smoke: authentication", () => {
    const token = login(email, password);
    check(token, { "smoke: login returned token": (t) => t !== null });

    if (!token) return;

    // ── 2. Event listing ────────────────────────────────────────────────────
    group("smoke: event listing", () => {
      const res = http.get(`${BASE_URL}/events`, {
        headers: jsonHeaders(token),
        tags: { endpoint: "events" },
      });
      check(res, {
        "smoke events: 200":         (r) => r.status === 200,
        "smoke events: body not empty": (r) => (r.body as string).length > 10,
        "smoke events: <800ms":      (r) => r.timings.duration < 800,
      });
    });

    // ── 3. Seat map ─────────────────────────────────────────────────────────
    group("smoke: seat layout", () => {
      const perfId = SEED.performanceId;
      const res = http.get(`${BASE_URL}/seats/performance/${perfId}`, {
        headers: jsonHeaders(token),
        tags: { endpoint: "seat_map" },
      });
      check(res, {
        "smoke seat map: 200":    (r) => r.status === 200,
        "smoke seat map: <800ms": (r) => r.timings.duration < 800,
      });
    });

    // ── 4. Seat lock status ─────────────────────────────────────────────────
    group("smoke: seat lock status", () => {
      const perfId = SEED.performanceId;
      const res = http.get(`${BASE_URL}/seat-locks/status/${perfId}`, {
        headers: jsonHeaders(token),
        tags: { endpoint: "seat_lock_status" },
      });
      check(res, {
        "smoke lock status: 200":    (r) => r.status === 200,
        "smoke lock status: <800ms": (r) => r.timings.duration < 800,
      });
    });

    // ── 5. Booking history ──────────────────────────────────────────────────
    group("smoke: my bookings", () => {
      const res = http.get(`${BASE_URL}/bookings/my-bookings`, {
        headers: jsonHeaders(token),
        tags: { endpoint: "my_bookings" },
      });
      check(res, {
        "smoke bookings: 200":    (r) => r.status === 200,
        "smoke bookings: <800ms": (r) => r.timings.duration < 800,
      });
    });

    // ── 6. Auth /me ─────────────────────────────────────────────────────────
    group("smoke: auth me", () => {
      const res = http.get(`${BASE_URL}/auth/me`, {
        headers: jsonHeaders(token),
        tags: { endpoint: "auth_me" },
      });
      check(res, {
        "smoke auth me: 200":    (r) => r.status === 200,
        "smoke auth me: <500ms": (r) => r.timings.duration < 500,
      });
    });

    sleep(1);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────
export function handleSummary(data: any) {
  const passed = data.metrics.checks?.values?.passes === data.metrics.checks?.values?.passes;
  console.log("\n==============================");
  console.log("SMOKE TEST RESULT");
  console.log("==============================");
  console.log(`Checks passed : ${data.metrics.checks?.values?.passes ?? 0}`);
  console.log(`Checks failed : ${data.metrics.checks?.values?.fails  ?? 0}`);
  console.log(`p95 response  : ${data.metrics.http_req_duration?.values?.["p(95)"]?.toFixed(0) ?? "N/A"} ms`);
  console.log(`Error rate    : ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`);
  console.log("==============================\n");

  return {
    "reports/smoke-summary.json": JSON.stringify(data, null, 2),
  };
}
