# Unit Testing & CI/CD Design

**Date:** 2026-05-30
**Project:** aws-dashboard (open-source)
**Goal:** ≥ 90% test coverage across all source files; automated CI/CD via GitHub Actions

---

## 1. Test Infrastructure

### Framework
- **Test runner:** Vitest
- **Coverage:** `@vitest/coverage-v8` (V8-based, no extra binary)
- **Component testing:** `@testing-library/react` + `@testing-library/user-event`
- **DOM matchers:** `@testing-library/jest-dom`
- **Browser environment:** `jsdom`

### New devDependencies
```
vitest
@vitest/coverage-v8
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
jsdom
```

### Config files

**`vitest.config.ts`** (project root):
- `environment: "jsdom"`
- `globals: true`
- `setupFiles: ["src/test-setup.ts"]`
- Coverage provider: `v8`, targeting `src/`
- Coverage thresholds: `lines: 90, functions: 90, branches: 90, statements: 90`
- Coverage reporters: `text-summary`, `lcov`

**`src/test-setup.ts`**:
- Imports `@testing-library/jest-dom` to extend Vitest matchers

### package.json scripts
```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

### Test folder layout
```
src/__tests__/
  test-utils.tsx              ← renderWithProviders helper
  lib/
    aws-config-parser.test.ts
    constants.test.ts
    utils.test.ts
  components/
    section-shell.test.tsx
    push-notifications-section.test.tsx
    push-notification-detail.test.tsx
    cognito-section.test.tsx
    (one file per section component)
  api/
    sns-platforms.test.ts
    sns-platforms-detail.test.ts
    cognito.test.ts
    profiles.test.ts
    (one file per route with logic branches)
  context/
    nav-context.test.tsx
    profile-context.test.tsx
```

---

## 2. What Gets Tested and How

### Layer 1 — Pure lib functions (no mocking)

**`aws-config-parser.ts`**
- `extractAccountId`: ARN regex match, SSO ID extraction, null fallback
- `deriveGroup`: prefix before first `-`, profile with no `-` returns full name
- `getGroups`: deduplicates groups correctly
- `invalidateCache`: resets the module-level cache
- `parseAwsConfig`: full flow with `loadSharedConfigFiles` and `STSClient` mocked via `vi.mock`

**`constants.ts`**
- `getRegion`: returns `?region=` query param when present
- `getRegion`: falls back to `AWS_DASHBOARD_REGION` env var
- `getRegion`: falls back to `ap-southeast-1` when neither is set

**`utils.ts`**
- `cn()`: merges class names correctly, handles conditionals and tailwind conflicts

### Layer 2 — API routes (AWS SDK mocked)

Each route test stubs SDK clients with `vi.mock("@aws-sdk/client-<service>")`. Every stubbed command is a `vi.fn()` returning a resolved promise.

**Per-route test cases:**
- Happy path: correct JSON shape returned
- SDK throws: returns empty array or `{ error: string }`
- `?profile=` present: filters to matching account only
- No `?profile=`: fans out across all accounts via `Promise.all`
- `?region=` param: passed through to SDK client constructor

**Priority routes** (contain the most logic branches):
- `sns-platforms/route.ts` — pagination loop, ARN parsing, fan-out
- `sns-platforms/detail/route.ts` — parallel fetch + pagination, missing params → 400
- `cognito/route.ts` — nested pagination, fan-out
- `profiles/route.ts` — account discovery
- `cognito/detail/route.ts` — date range filtering

### Layer 3 — React components (fetch mocked)

**Mocking strategy:**
- `fetch` stubbed globally: `vi.stubGlobal("fetch", vi.fn())`
- Each test configures `fetch` mock to return specific data
- `renderWithProviders` helper in `src/__tests__/test-utils.tsx` wraps components with `ProfileProvider`, `NavProvider`, `RegionProvider`, and `AccountsProvider`

**`section-shell.tsx`**
- `SectionShell`: renders title; shows Refresh button when `onRefresh` provided; disables button when `loading` is true
- `RequireProfile`: renders prompt when profile is null; renders children when profile is set
- `StatusBadge`: maps `ACTIVE`/`COMPLETE`/`AVAILABLE`/`HEALTHY` → `default` variant; `FAILED`/`ERROR`/`UNHEALTHY` → `destructive`; `PROGRESS`/`PENDING`/`CREATING` → `secondary`; anything else → `outline`
- `StatCard`: renders label and value

**`push-notifications-section.tsx`**
- Shows "Select an AWS account" when no profile is set
- Fetches `/api/sns-platforms` when profile is set; renders platform rows
- Platform badges show correct label (Android/FCM, iOS/APNS, iOS Sandbox)
- Clicking a row renders `PushNotificationDetail`

**`push-notification-detail.tsx`**
- Shows loading spinner while fetching
- Renders attribute cards and endpoint table on success
- Shows error message when fetch returns `{ error }`
- Back button calls `onBack` prop

**Context providers**
- `NavContext`: `useNav` returns `"dashboard"` by default; `setSection` updates `section`
- `ProfileContext`: `useProfile` returns `null` by default; `setProfile` updates `profile`

---

## 3. GitHub Actions CI/CD

### Workflow file
`.github/workflows/ci.yml`

### Triggers
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'   # nightly at 02:00 UTC
```

### Jobs

All three jobs run in parallel. No sequential dependency — a lint failure does not block test or build.

#### `lint`
- Runner: `ubuntu-latest`
- Node: `20`
- Steps: `npm ci` → `npm run lint`

#### `build`
- Runner: `ubuntu-latest`
- Node: `20`
- Steps: `npm ci` → `npm run build`
- Caches `.next/` using `actions/cache` keyed on `package-lock.json` hash

#### `test`
- Runner: `ubuntu-latest`
- Node: `20`
- Steps: `npm ci` → `npm run test:coverage`
- Uploads `coverage/` as a build artifact (retained 7 days)
- **Coverage gate:** Vitest threshold config in `vitest.config.ts` causes non-zero exit if any metric < 90%, failing the job automatically

### Nightly behaviour
Nightly runs execute all three jobs identically. GitHub sends a failure email to the repository owner automatically on failure (default GitHub behaviour for scheduled workflows).

### Node version rationale
Pinned to Node 20 — matches `engines: { node: ">=20.0.0" }` declared by `@aws-sdk/client-sns` and other AWS SDK packages.

---

## Coverage Exclusions

The following paths are excluded from coverage collection (they contain no testable logic):
- `src/app/layout.tsx` — Next.js root layout, only wires providers
- `src/app/page.tsx` — thin routing switch, tested implicitly by nav context tests
- `src/components/ui/**` — shadcn/ui generated components, third-party
- `src/components/theme-provider.tsx` — thin wrapper around `next-themes`
- `src/components/theme-toggle.tsx` — no logic, only UI
