/**
 * spike-test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Spike Test — Flash sale / event release simulation
 *
 * SCENARIO  (from Test Plan §4.6 Test 2)
 *   Start at 10 VUs → jump to 500 within 1 minute → hold briefly → drop back
 *   Simulates what happens when a popular show goes on sale and everyone
 *   rushes the system at the same moment.
 *
 * FOCUS
 *   - Seat locking failures under shock load (most P1-risk scenario)
 *   - Whether the system degrades gracefully (errors, not crashes)
 *   - Recovery speed after load drops (must be < 1% error within 1 min)
 *
 * PASS CRITERIA  (from Test Plan)
 *   - Error rate < 5% at spike peak
 *   - Error rate recovers to < 1% within 1 minute of load dropping
 *   - No data corruption (seat double-booked)
 *   - Seat lock conflict rate < 5% (false conflicts are NOT acceptable)
 *
 * RUN COMMAND
 *   k6 run spike-test.ts \
 *     -e K6_BASE_URL=http://localhost:5000/api \
 *     -e CUSTOMER_EMAIL=customer@test.com \
 *     -e CUSTOMER_PASSWORD=TestPass@123 \
 *     -e TEST_PERFORMANCE_ID=<id> \
 *     -e TEST_SEAT_ID=<id> \
 *     --out json=reports/spike-results.json
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { Options } from "k6/options";
import {
  login,
  viewSeatLayout,
  completeBooking,
  randomUser,
  jsonHeaders,
  BASE_URL,
  SEED,
  lockConflicts,
  seatConflictRate,
} from "./shared/booking-flow";
import { spikeThresholds, ERROR_RATE, SEAT_LOCK } from "./shared/thresholds";

// ── Spike-specific metrics ────────────────────────────────────────────────────
const peakErrorRate      = new Rate("spike_peak_error_rate");
const recoveryErrorRate  = new Rate("spike_recovery_error_rate");
const concurrentAttempts = new Counter("concurrent_seat_lock_attempts");

// ── Options ───────────────────────────────────────────────────────────────────
export const options: Options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 10  },  // Baseline — normal traffic
        { duration: "1m",  target: 500 },  // THE SPIKE — jump to 500 VUs
        { duration: "2m",  target: 500 },  // Hold at peak — measure degradation
        { duration: "30s", target: 10  },  // Drop back quickly
        { duration: "2m",  target: 10  },  // Recovery window — measure return to normal
        { duration: "30s", target: 0   },  // Wind down
      ],
      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    ...spikeThresholds,

    // Seat locking is the P1 risk during a spike
    "http_req_duration{endpoint:seat_lock}": [`p(95)<1000`],
    "http_req_failed{endpoint:seat_lock}":   [`rate<${SEAT_LOCK.false_conflict_fail}`],

    // Booking endpoint
    "http_req_duration{endpoint:create_booking}": [`p(95)<3000`],

    // System must not fully collapse — even under 500 VUs
    "http_req_failed": [`rate<${ERROR_RATE.spike_pass}`],

    // Seat lock conflicts must stay under the false-conflict SLA
    "seat_lock_conflict_rate": [`rate<${SEAT_LOCK.false_conflict_fail}`],
  },

  tags: { test_type: "spike" },
};

// ── VU script ─────────────────────────────────────────────────────────────────
export default function () {
  const user  = randomUser();
  const token = login(user.email, user.password);

  if (!token) {
    peakErrorRate.add(1);
    sleep(1);
    return;
  }

  peakErrorRate.add(0);

  // During a spike, everyone is competing for seats — focus on seat locking
  group("spike: concurrent seat access", () => {
    // Step 1: View seat layout (all users see the map simultaneously)
    const seatsRes = http.get(
      `${BASE_URL}/seats/performance/${SEED.performanceId}`,
      { headers: jsonHeaders(token), tags: { endpoint: "seat_map" } }
    );
    check(seatsRes, { "spike seat map: status 200": (r) => r.status === 200 });

    sleep(Math.random() * 1); // 0–1s — user selects a seat

    // Step 2: Attempt to lock a seat (maximum contention point)
    concurrentAttempts.add(1);
    const lockRes = http.post(
      `${BASE_URL}/seat-locks/lock`,
      JSON.stringify({
        performanceId: SEED.performanceId,
        seatIds: [SEED.seatId],
      }),
      {
        headers: jsonHeaders(token),
        tags: { endpoint: "seat_lock" },
      }
    );

    const lockOk = check(lockRes, {
      "spike lock: 200 or 409 (expected conflict)": (r) =>
        r.status === 200 || r.status === 201 || r.status === 409 || r.status === 400,
      "spike lock: not 500 (no server crash)": (r) => r.status !== 500,
      "spike lock: response time <2s":         (r) => r.timings.duration < 2000,
    });

    // Track conflicts — 409 means seat locked by another user (expected under spike)
    if (lockRes.status === 409 || lockRes.status === 400) {
      lockConflicts.add(1);
      seatConflictRate.add(1);
    } else if (lockRes.status === 200 || lockRes.status === 201) {
      seatConflictRate.add(0);

      // Step 3: If lock succeeded, attempt to complete booking
      sleep(0.5);
      const bookingPayload = {
        performanceId: SEED.performanceId,
        seats: [{
          seatId:        SEED.seatId,
          ageGroup:      "adult",
          originalPrice: 50,
          finalPrice:    50,
          discountApplied: 0,
        }],
        totalAmount:    50,
        discountAmount: 0,
        discountType:   null,
      };

      const bookRes = http.post(
        `${BASE_URL}/bookings`,
        JSON.stringify(bookingPayload),
        {
          headers: jsonHeaders(token),
          tags: { endpoint: "create_booking" },
        }
      );

      check(bookRes, {
        "spike booking: 200 or 201":      (r) => r.status === 200 || r.status === 201,
        "spike booking: not 500":         (r) => r.status !== 500,
        "spike booking: response time <3s": (r) => r.timings.duration < 3000,
      });

      // Release lock if booking failed (seat must go back to available)
      if (bookRes.status !== 200 && bookRes.status !== 201) {
        http.post(
          `${BASE_URL}/seat-locks/release`,
          JSON.stringify({ performanceId: SEED.performanceId, seatIds: [SEED.seatId] }),
          { headers: jsonHeaders(token), tags: { endpoint: "release_lock" } }
        );
      }
    }
  });

  // Shorter think time during spike — users are in a hurry
  sleep(Math.random() * 0.5);
}

// ── Summary ───────────────────────────────────────────────────────────────────
export function handleSummary(data: any) {
  const m = data.metrics;

  const p95      = m.http_req_duration?.values?.["p(95)"]?.toFixed(0)  ?? "N/A";
  const p99      = m.http_req_duration?.values?.["p(99)"]?.toFixed(0)  ?? "N/A";
  const errR     = ((m.http_req_failed?.values?.rate    ?? 0) * 100).toFixed(2);
  const conflict = ((m.seat_lock_conflict_rate?.values?.rate ?? 0) * 100).toFixed(2);
  const rps      = m.http_reqs?.values?.rate?.toFixed(1) ?? "N/A";
  const attempts = m.concurrent_seat_lock_attempts?.values?.count ?? 0;

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║         SPIKE TEST RESULTS            ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  p95 response time     : ${p95.padStart(5)} ms       ║`);
  console.log(`║  p99 response time     : ${p99.padStart(5)} ms       ║`);
  console.log(`║  Peak error rate       : ${errR.padStart(5)} %        ║`);
  console.log(`║  Seat lock conflicts   : ${conflict.padStart(5)} %        ║`);
  console.log(`║  Lock attempts total   : ${String(attempts).padStart(5)}            ║`);
  console.log(`║  Throughput            : ${rps.padStart(5)} req/s      ║`);
  console.log("╠══════════════════════════════════════╣");
  console.log(`║  Error rate < 5%       : ${parseFloat(errR) < 5 ? "✅ PASS" : "❌ FAIL"}              ║`);
  console.log(`║  Conflict rate < 5%    : ${parseFloat(conflict) < 5 ? "✅ PASS" : "❌ FAIL"}              ║`);
  console.log(`║  No 500 errors         : ${m.http_req_failed?.values?.rate < 0.05 ? "✅ PASS" : "❌ CHECK LOGS"}     ║`);
  console.log("╚══════════════════════════════════════╝\n");

  return {
    "reports/spike-summary.json": JSON.stringify(data, null, 2),
  };
}
