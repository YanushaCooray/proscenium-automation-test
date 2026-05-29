# Proscenium V2 — Playwright E2E Framework

> Production-grade Playwright test framework with Allure reporting, BVT/Regression separation, and CI/CD integration.

---

## 📁 Project Structure

```
playwright-framework/
├── .github/
│   └── workflows/
│       └── playwright.yml          # CI/CD: BVT on every push, Regression on main/develop
│
├── fixtures/
│   ├── global.setup.ts             # Auth state: logs in once, saves storage state
│   └── index.ts                    # Custom test fixture: page objects + Allure helpers
│
├── pages/                          # Page Object Model
│   ├── BasePage.ts                 # Shared interactions, waits, assertions
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   └── NavigationPage.ts
│
├── tests/
│   ├── bvt/                        # 🟢 BVT — fast smoke, Chromium only
│   │   ├── login.bvt.spec.ts
│   │   └── navigation.bvt.spec.ts
│   └── regression/                 # 🔵 Regression — thorough, cross-browser
│       ├── login.regression.spec.ts
│       └── dashboard.regression.spec.ts
│
├── utils/
│   ├── ApiHelper.ts                # REST API helper for seeding/teardown
│   ├── TestDataFactory.ts          # Random data generation
│   └── WaitHelpers.ts              # Reusable wait strategies
│
├── data/
│   └── testData.ts                 # Static constants (users, routes, messages)
│
├── .env.dev                        # Dev environment variables
├── .env.staging                    # Staging environment variables
├── playwright.config.ts            # Playwright configuration
├── tsconfig.json
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- [Allure CLI](https://docs.qameta.io/allure/#_installing_a_commandline) (for local reports)

### Install

```bash
npm install
npx playwright install        # all browsers
# OR just Chromium for BVT:
npx playwright install chromium
```

### Configure environment

```bash
cp .env.dev .env.dev.local
# Edit .env.dev.local with real credentials (never commit)
```

---

## 🧪 Running Tests

### BVT (smoke — fast, Chromium only)
```bash
npm run test:bvt
```

### Regression (full cross-browser)
```bash
npm run test:regression
```

### All tests
```bash
npm test
```

### Headed mode (see the browser)
```bash
npm run test:headed
```

### Debug mode (with Playwright Inspector)
```bash
npm run test:debug
```

### Specific environment
```bash
TEST_ENV=staging npm run test:bvt
TEST_ENV=prod npm run test:regression
```

---

## 📊 Allure Reports

```bash
# Run tests and generate report in one command:
npm run test:bvt:ci        # or test:regression:ci
npm run report             # generates + opens Allure report

# Or step by step:
npm run allure:generate    # generates report from allure-results/
npm run allure:open        # opens the generated report
npm run allure:serve       # live serve (no generate step needed)
```

---

## 🏷️ Test Tags

All tests are tagged for flexible filtering:

| Tag | Usage | Runs In |
|-----|-------|---------|
| `@bvt` | Build Verification Tests — critical happy paths | Chromium only |
| `@regression` | Full regression coverage — all edge cases | Chromium, Firefox, Safari, Mobile |

Adding new tags to a test:
```typescript
test('@bvt @regression My test', async () => { ... });
```

---

## ✍️ Writing New Tests

### BVT test (fast smoke)
```typescript
// tests/bvt/myFeature.bvt.spec.ts
import { test, allure } from '../../fixtures';

test.describe('My Feature — BVT', () => {
  test('@bvt Critical path works', async ({ page }) => {
    await allure.epic('My Feature');
    await allure.feature('Core');
    await allure.story('Happy Path');

    // your test here
  });
});
```

### Regression test (thorough)
```typescript
// tests/regression/myFeature.regression.spec.ts
import { test, expect, allure } from '../../fixtures';
import { TestDataFactory } from '../../utils/TestDataFactory';

test.describe('My Feature — Regression', () => {
  test('@regression Edge case is handled', async ({ page }) => {
    await allure.epic('My Feature');
    // ...
  });
});
```

### Adding a new Page Object
```typescript
// pages/MyPage.ts
import { type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class MyPage extends BasePage {
  readonly heading = this.page.getByRole('heading', { level: 1 });

  constructor(page: Page) { super(page); }

  async goto() { await this.navigate('/my-route'); }
}
```

Then register it in `fixtures/index.ts`.

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Frontend base URL |
| `API_BASE_URL` | API base URL |
| `TEST_ENV` | `dev` \| `staging` \| `prod` |
| `ADMIN_EMAIL` | Admin test account email |
| `ADMIN_PASSWORD` | Admin test account password |
| `USER_EMAIL` | Standard test account email |
| `USER_PASSWORD` | Standard test account password |

---

## 🤖 CI/CD

The GitHub Actions workflow in `.github/workflows/playwright.yml`:

| Trigger | Suite | Browsers |
|---------|-------|----------|
| Every push / PR | BVT | Chromium |
| Push to `main` / `develop` | Regression | Chrome, Firefox, Safari, Mobile |
| Manual dispatch | Choice | Configurable |

Allure results are published to **GitHub Pages** after each run.

---

## 🗂️ Separate Repo vs Inside Dev Repo

This framework is designed as a **separate repository**. Here's why:

| | Separate Repo ✅ | Inside Dev Repo |
|--|-----------------|-----------------|
| CI independence | ✅ Test CI runs independently | ❌ Coupled to app CI |
| Team ownership | ✅ QA team owns it | ❌ Mixed ownership |
| Dependencies | ✅ No Playwright noise in app `package.json` | ❌ Bloats dev deps |
| Versioning | ✅ Tag test releases independently | ❌ Tied to app releases |
| Permissions | ✅ Control who can merge test changes | ❌ Same PR flow as prod code |

**Recommendation**: Keep this as `proscenium-v2-tests` (separate repo), and connect it to the main repo via GitHub Actions that trigger on the app's deploy events.
