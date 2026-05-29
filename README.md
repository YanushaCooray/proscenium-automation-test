# Proscenium — K6 Performance Tests

Performance test suite for The Proscenium Theatre Booking System.
Covers: Smoke → Load → Spike → Stress, exactly as defined in Test Plan §4.6.

---

## 📁 Structure

```
k6-performance/
├── smoke-test.ts            # 2 VUs, 2 min  — system health check
├── load-test.ts             # 0→100 VUs     — normal peak traffic
├── spike-test.ts            # 10→500 VUs    — flash sale simulation
├── stress-test.ts           # 10→1000 VUs   — find the breaking point
├── shared/
│   ├── thresholds.ts        # All SLA numbers in one place
│   └── booking-flow.ts      # Shared API flows (login, browse, lock, book)
└── reports/                 # JSON + HTML output (git-ignored)
```

---

## ⚙️ Prerequisites

```bash
# Install K6
brew install k6          # macOS
choco install k6         # Windows
sudo apt install k6      # Ubuntu/Debian

# Verify
k6 version
```

---

## 🔑 Environment Variables

All scripts read from environment variables. Either export them or pass with `-e`:

| Variable | Description | Default |
|---|---|---|
| `K6_BASE_URL` | Backend API base URL | `http://localhost:5000/api` |
| `CUSTOMER_EMAIL` | Test customer email | `customer@test.com` |
| `CUSTOMER_PASSWORD` | Test customer password | `TestPass@123` |
| `LOYALTY_EMAIL` | Loyalty member email | `loyalty@test.com` |
| `LOYALTY_PASSWORD` | Loyalty member password | `TestPass@123` |
| `TEST_PERFORMANCE_ID` | MongoDB ObjectId of seeded performance | **required** |
| `TEST_SEAT_ID` | MongoDB ObjectId of a seeded seat | **required** |

Get the IDs from MongoDB after running the seed scripts:
```bash
# In /backend
npm run seed:admin
npm run seed:pricing
# Then create a test event and note the performance + seat IDs
```

---

## 🚀 Running Tests

### Always run smoke first
```bash
k6 run smoke-test.ts \
  -e K6_BASE_URL=http://localhost:5000/api \
  -e CUSTOMER_EMAIL=customer@test.com \
  -e CUSTOMER_PASSWORD=TestPass@123 \
  -e TEST_PERFORMANCE_ID=<id> \
  -e TEST_SEAT_ID=<id>
```
If smoke fails → **stop here**. The system is broken. Do not proceed to load/spike/stress.

---

### Load test (normal peak)
```bash
k6 run load-test.ts \
  -e K6_BASE_URL=http://localhost:5000/api \
  -e CUSTOMER_EMAIL=customer@test.com \
  -e CUSTOMER_PASSWORD=TestPass@123 \
  -e TEST_PERFORMANCE_ID=<id> \
  -e TEST_SEAT_ID=<id> \
  --out json=reports/load-results.json
```
Duration: ~14 minutes | Max VUs: 100

---

### Spike test (flash sale)
```bash
k6 run spike-test.ts \
  -e K6_BASE_URL=http://localhost:5000/api \
  -e CUSTOMER_EMAIL=customer@test.com \
  -e CUSTOMER_PASSWORD=TestPass@123 \
  -e TEST_PERFORMANCE_ID=<id> \
  -e TEST_SEAT_ID=<id> \
  --out json=reports/spike-results.json
```
Duration: ~7 minutes | Max VUs: 500

---

### Stress test (find the limit)
```bash
k6 run stress-test.ts \
  -e K6_BASE_URL=http://localhost:5000/api \
  -e CUSTOMER_EMAIL=customer@test.com \
  -e CUSTOMER_PASSWORD=TestPass@123 \
  -e TEST_PERFORMANCE_ID=<id> \
  -e TEST_SEAT_ID=<id> \
  --out json=reports/stress-results.json
```
Duration: ~50 minutes | Max VUs: 1,000

---

## 📊 SLA Targets

From Test Plan §4.6:

| Metric | Target (pass) | Fail threshold |
|---|---|---|
| p50 response time | < 300 ms | > 500 ms |
| p95 response time | < 800 ms | > 1,200 ms |
| p99 response time | < 1,500 ms | > 2,500 ms |
| Error rate (normal load) | < 1% | > 2% |
| Booking throughput | ≥ 50 req/s | < 30 req/s |
| Seat lock conflict rate | < 2% | > 5% |

---

## 🔄 Test Execution Order

```
1. smoke-test     → confirms system is alive (2 min)
        ↓ PASS only
2. load-test      → normal peak traffic (14 min)
        ↓ PASS only
3. spike-test     → flash sale shock (7 min)
        ↓ after UAT sign-off
4. stress-test    → find the breaking point (50 min)
```

---

## 📈 Reading Results

Each test writes a JSON summary to `reports/`. Key fields to check:

```json
{
  "metrics": {
    "http_req_duration": { "values": { "p(95)": 720, "p(99)": 1100 } },
    "http_req_failed":   { "values": { "rate": 0.008 } },
    "booking_success_rate": { "values": { "rate": 0.97 } },
    "seat_lock_conflict_rate": { "values": { "rate": 0.012 } }
  }
}
```

For the stress test, look for where `p(99)` crosses 2,500 ms — that's your capacity ceiling. Document it in the performance report for the Theatre Owner.
