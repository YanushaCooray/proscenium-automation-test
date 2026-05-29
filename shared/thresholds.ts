/**
 * thresholds.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every SLA number in the test plan.
 * All K6 scripts import from here — change a target once, it applies everywhere.
 *
 * Source: Test Plan §4.6 Performance Targets
 */

// ── Response time targets (milliseconds) ─────────────────────────────────────
export const SLA = {
  p50_pass:  300,   // Average response time target
  p50_fail:  500,   // Average response time fail threshold
  p95_pass:  800,   // 95th percentile target
  p95_fail:  1200,  // 95th percentile fail threshold
  p99_pass:  1500,  // 99th percentile target
  p99_fail:  2500,  // 99th percentile fail threshold
};

// ── Error rate targets ────────────────────────────────────────────────────────
export const ERROR_RATE = {
  normal_pass:  0.01,   // < 1%  under normal load
  normal_fail:  0.02,   // > 2%  fail
  spike_pass:   0.05,   // < 5%  during spike peak
  recovery_pass: 0.01,  // < 1%  after spike load drops
};

// ── Throughput targets ────────────────────────────────────────────────────────
export const THROUGHPUT = {
  booking_min_rps: 50,  // ≥ 50 req/s concurrent booking throughput
  booking_fail_rps: 30, // < 30 req/s is a fail
};

// ── Seat lock targets ─────────────────────────────────────────────────────────
export const SEAT_LOCK = {
  false_conflict_pass: 0.02, // < 2%
  false_conflict_fail: 0.05, // > 5%
};

// ── Stress test recovery ──────────────────────────────────────────────────────
export const RECOVERY = {
  max_seconds: 180, // System must recover within 3 minutes of load removal
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built K6 threshold objects — paste directly into script options
// ─────────────────────────────────────────────────────────────────────────────

/** Standard thresholds for load test */
export const loadThresholds = {
  http_req_duration: [
    `p(50)<${SLA.p50_fail}`,
    `p(95)<${SLA.p95_fail}`,
    `p(99)<${SLA.p99_fail}`,
  ],
  http_req_failed: [`rate<${ERROR_RATE.normal_fail}`],
  http_reqs:       [`rate>=${THROUGHPUT.booking_fail_rps}`],
};

/** Relaxed thresholds for spike test — system degrades gracefully under shock */
export const spikeThresholds = {
  http_req_duration: [
    `p(95)<${SLA.p99_fail}`,   // Allow up to p99 pass during spike
  ],
  http_req_failed: [`rate<${ERROR_RATE.spike_pass}`],
};

/** Stress test does NOT use hard thresholds — it runs to breaking point */
export const stressThresholds = {
  http_req_duration: [
    `p(99)<${SLA.p99_fail * 2}`, // Very lenient — we are finding the limit
  ],
};

/** Smoke thresholds — strict, very low VU count */
export const smokeThresholds = {
  http_req_duration: [
    `p(95)<${SLA.p95_pass}`,
    `p(99)<${SLA.p99_pass}`,
  ],
  http_req_failed: [`rate<${ERROR_RATE.normal_pass}`],
};
