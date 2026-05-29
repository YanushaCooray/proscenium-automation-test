/**
 * load-test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Load Test — Normal peak traffic simulation
 *
 * SCENARIO  (from Test Plan §4.6 Test 1)
 *   Ramp to 100 VUs over 2 minutes → hold for 10 minutes → ramp down 2 minutes
 *   Total duration: ~14 minutes
 *
 * TRAFFIC MIX  (from Test Plan §4.6)
 *   40% — Browse events        (GET /api/events)
 *   30% — View seat layout     (GET /api/seats/performance/:id + seat-lock status)
 *   30% — Complete booking     (POST lock → POST booking)
 *
 * PASS CRITERIA
 *   p95 < 800 ms
 *   error rate < 1%
 *   booking throughput ≥ 50 req/s
 *
 * RUN COMMAND
 *   k6 run load-test.ts \
 *     -e K6_BASE_URL=http://localhost:5000/api \
 *     -e CUSTOMER_EMAIL=customer@test.com \
 *     -e CUSTOMER_PASSWORD=TestPass@123 \
 *     -e TEST_PERFORMANCE_ID=<id> \
 *     -e TEST_SEAT_ID=<id> \
 *     --out json=reports/load-results.json
 */

import { check, sleep, group } from "k6";
import { Options } from "k6/options";
import {
  login,
  browseEvents,
  viewSeatLayout,
  completeBooking,
  viewMyBookings,
  randomUser,
  SEED,
} from "./shared/booking-flow";
import { loadThresholds, SLA, ERROR_RATE } from "./shared/thresholds";

// ── Options ───────────────────────────────────────────────────────────────────
export const options: Options = {
  scenarios: {
    load_test: {
      executor:    "ramping-vus",
      startVUs:    0,
      stages: [
        { duration: "2m",  target: 100 },  // Ramp up to 100 VUs over 2 min
        { duration: "10m", target: 100 },  // Hold at 100 VUs for 10 min
        { duration: "2m",  target: 0   },  // Ramp down
      ],
      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    ...loadThresholds,

    // Endpoint-specific thresholds
    "http_req_duration{endpoint:login}":          [`p(95)<${SLA.p95_fail}`],
    "http_req_duration{endpoint:events}":         [`p(95)<${SLA.p95_fail}`],
    "http_req_duration{endpoint:seat_map}":       [`p(95)<${SLA.p95_fail}`],
    "http_req_duration{endpoint:seat_lock}":      [`p(95)<500`],
    "http_req_duration{endpoint:create_booking}": [`p(95)<${SLA.p99_fail}`],

    // Custom business metrics
    "booking_success_rate":  [`rate>${1 - ERROR_RATE.normal_fail}`],
    "seat_lock_success_rate":[`rate>0.90`],
    "seat_lock_conflict_rate":[`rate<0.10`],
  },

  tags: { test_type: "load" },
};

// ── VU script ─────────────────────────────────────────────────────────────────
export default function () {
  const user  = randomUser();
  const token = login(user.email, user.password);

  if (!token) {
    sleep(2);
    return;
  }

  // Distribute traffic according to the 40/30/30 mix
  const roll = Math.random() * 100;

  if (roll < 40) {
    // ── 40%: Browse events ──────────────────────────────────────────────────
    group("browse events", () => {
      browseEvents(token);
    });

  } else if (roll < 70) {
    // ── 30%: View seat layout ───────────────────────────────────────────────
    group("view seat layout", () => {
      viewSeatLayout(token, SEED.performanceId);
    });

  } else {
    // ── 30%: Complete booking ───────────────────────────────────────────────
    group("complete booking", () => {
      // First view the seat map (realistic user journey)
      viewSeatLayout(token, SEED.performanceId);
      sleep(1); // User selects seat

      const success = completeBooking(token, SEED.performanceId, SEED.seatId);

      // After booking, check booking history (realistic post-booking action)
      if (success) {
        sleep(0.5);
        viewMyBookings(token);
      }
    });
  }

  // Realistic think time between iterations
  sleep(Math.random() * 3 + 1); // 1–4 seconds
}

// ── Summary ───────────────────────────────────────────────────────────────────
export function handleSummary(data: any) {
  const m = data.metrics;

  const p50   = m.http_req_duration?.values?.["p(50)"]?.toFixed(0)  ?? "N/A";
  const p95   = m.http_req_duration?.values?.["p(95)"]?.toFixed(0)  ?? "N/A";
  const p99   = m.http_req_duration?.values?.["p(99)"]?.toFixed(0)  ?? "N/A";
  const errR  = ((m.http_req_failed?.values?.rate   ?? 0) * 100).toFixed(2);
  const rps   = m.http_reqs?.values?.rate?.toFixed(1) ?? "N/A";
  const bSucc = ((m.booking_success_rate?.values?.rate ?? 0) * 100).toFixed(1);
  const lSucc = ((m.seat_lock_success_rate?.values?.rate ?? 0) * 100).toFixed(1);

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║         LOAD TEST RESULTS             ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  p50 response time   : ${p50.padStart(7)} ms      ║`);
  console.log(`║  p95 response time   : ${p95.padStart(7)} ms      ║`);
  console.log(`║  p99 response time   : ${p99.padStart(7)} ms      ║`);
  console.log(`║  Error rate          : ${errR.padStart(7)} %       ║`);
  console.log(`║  Throughput          : ${rps.padStart(7)} req/s    ║`);
  console.log(`║  Booking success     : ${bSucc.padStart(7)} %       ║`);
  console.log(`║  Seat lock success   : ${lSucc.padStart(7)} %       ║`);
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  p95 target < 800ms  : ${parseFloat(p95) < 800 ? "✅ PASS" : "❌ FAIL"}              ║`);
  console.log(`║  Error rate < 1%     : ${parseFloat(errR) < 1 ? "✅ PASS" : "❌ FAIL"}              ║`);
  console.log("╚══════════════════════════════════════╝\n");

  return {
    "reports/load-summary.json": JSON.stringify(data, null, 2),
  };
}
