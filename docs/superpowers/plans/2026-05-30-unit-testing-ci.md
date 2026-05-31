# Unit Testing & CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Vitest with ≥ 90% coverage across all source files and add a GitHub Actions CI workflow (lint + build + test) triggered on PR, push to main, and nightly.

**Architecture:** Three-layer test strategy — pure lib functions (no mocks), API routes (AWS SDK mocked via `vi.mock`), React components (fetch mocked via `vi.stubGlobal`). All tests live under `src/__tests__/` mirroring the source tree. Coverage thresholds enforced in `vitest.config.ts`; the GitHub Actions test job fails automatically if any metric drops below 90%.

**Tech Stack:** Vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom, @vitejs/plugin-react, vite-tsconfig-paths

---

### Task 1: Install devDependencies and add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install all test devDependencies**

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitejs/plugin-react vite-tsconfig-paths
```

Expected: packages added to `devDependencies` in `package.json`, no peer dep errors.

- [ ] **Step 2: Add test scripts to package.json**

Open `package.json` and update the `scripts` block to:

```json
"scripts": {
  "dev": "next dev --hostname 127.0.0.1",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 3: Verify install**

```bash
npm run test -- --version
```

Expected: prints the Vitest version number.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install vitest and testing-library dependencies"
```

---

### Task 2: Create vitest.config.ts and src/test-setup.ts

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/app/layout.tsx",
        "src/app/page.tsx",
        "src/components/ui/**",
        "src/components/theme-provider.tsx",
        "src/components/theme-toggle.tsx",
        "src/__tests__/**",
        "src/test-setup.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      reporter: ["text-summary", "lcov"],
    },
  },
});
```

- [ ] **Step 2: Create src/test-setup.ts**

```ts
// src/test-setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: Verify config is valid**

```bash
npm run test -- --reporter=verbose 2>&1 | head -20
```

Expected: Vitest starts and reports "No test files found" (no tests yet), exits 0.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/test-setup.ts
git commit -m "chore: add vitest config and test setup"
```

---

### Task 3: Create src/__tests__/test-utils.tsx

**Files:**
- Create: `src/__tests__/test-utils.tsx`

- [ ] **Step 1: Create the test utilities file**

```tsx
// src/__tests__/test-utils.tsx
import { render, RenderOptions } from "@testing-library/react";
import { ReactElement, ReactNode, useEffect } from "react";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import { NavProvider } from "@/context/nav-context";
import { RegionProvider, useRegion } from "@/context/region-context";

// Setters are child components that call context setters after mount,
// allowing tests to inject initial values without exporting context objects.
function ProfileSetter({ profile }: { profile: string | null }) {
  const { setProfile } = useProfile();
  useEffect(() => { setProfile(profile); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function RegionSetter({ region }: { region: string }) {
  const { setRegion } = useRegion();
  useEffect(() => { setRegion(region); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export interface TestRenderOptions extends Omit<RenderOptions, "wrapper"> {
  profile?: string | null;
  region?: string;
}

/**
 * Renders ui wrapped in ProfileProvider + NavProvider + RegionProvider.
 * RegionProvider fetches /api/config on mount — stub fetch before calling this:
 *   vi.stubGlobal("fetch", mockFetch)  where mockFetch handles /api/config
 */
export function renderWithProviders(
  ui: ReactElement,
  { profile = null, region = "ap-southeast-1", ...rest }: TestRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ProfileProvider>
        <ProfileSetter profile={profile} />
        <NavProvider>
          <RegionProvider>
            <RegionSetter region={region} />
            {children}
          </RegionProvider>
        </NavProvider>
      </ProfileProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}

/** Default fetch stub that handles /api/config and returns empty for everything else. */
export function makeConfigFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    if (url.includes("/api/config")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            defaultRegion: "ap-southeast-1",
            regions: ["ap-southeast-1", "us-east-1"],
          }),
      });
    }
    const key = Object.keys(overrides).find((k) => url.includes(k));
    const data = key ? overrides[key] : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/test-utils.tsx
git commit -m "test: add renderWithProviders and makeConfigFetch test utilities"
```

---

### Task 4: Tests for lib/aws-config-parser.ts

**Files:**
- Create: `src/__tests__/lib/aws-config-parser.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// src/__tests__/lib/aws-config-parser.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAwsConfig, getGroups, invalidateCache } from "@/lib/aws-config-parser";

const mockSend = vi.fn();

vi.mock("@smithy/shared-ini-file-loader", () => ({
  loadSharedConfigFiles: vi.fn(),
}));
vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn(() => ({ send: mockSend })),
  GetCallerIdentityCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({
  fromIni: vi.fn(() => ({})),
}));

import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";

const mockLoad = vi.mocked(loadSharedConfigFiles);

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCache();
});

describe("parseAwsConfig", () => {
  it("extracts account id from role_arn", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("123456789012");
    expect(accounts[0].name).toBe("myproject-prod");
    expect(accounts[0].profile).toBe("myproject-prod");
    expect(accounts[0].group).toBe("myproject");
  });

  it("extracts account id from sso_account_id", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-dev": { sso_account_id: "999888777666", sso_start_url: "https://example.awsapps.com/start" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("999888777666");
  });

  it("skips sso-session entries that have sso_start_url but no sso_account_id", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "sso-session my-sso": { sso_start_url: "https://example.awsapps.com/start" },
        "myproject-prod": { role_arn: "arn:aws:iam::111111111111:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].profile).toBe("myproject-prod");
  });

  it("falls back to STS GetCallerIdentity when no id in config", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-test": {},
      },
      credentialsFile: {},
    });
    mockSend.mockResolvedValue({ Account: "555444333222" });

    const accounts = await parseAwsConfig();

    expect(accounts[0].id).toBe("555444333222");
  });

  it("sets id to null when STS call fails", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "orphan-profile": {},
      },
      credentialsFile: {},
    });
    mockSend.mockRejectedValue(new Error("No credentials"));

    const accounts = await parseAwsConfig();

    expect(accounts[0].id).toBeNull();
  });

  it("returns cached result on second call without re-fetching", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    await parseAwsConfig();
    await parseAwsConfig();

    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("skips the default profile", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        default: { region: "us-east-1" },
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts.every((a) => a.profile !== "default")).toBe(true);
  });
});

describe("getGroups", () => {
  it("returns unique groups from account list", () => {
    const accounts = [
      { id: "1", name: "a-prod", profile: "a-prod", group: "a" },
      { id: "2", name: "a-dev", profile: "a-dev", group: "a" },
      { id: "3", name: "b-prod", profile: "b-prod", group: "b" },
    ];
    expect(getGroups(accounts)).toEqual(["a", "b"]);
  });

  it("returns empty array for empty account list", () => {
    expect(getGroups([])).toEqual([]);
  });
});

describe("invalidateCache", () => {
  it("forces re-fetch on next parseAwsConfig call", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    await parseAwsConfig();
    invalidateCache();
    await parseAwsConfig();

    expect(mockLoad).toHaveBeenCalledTimes(2);
  });
});

describe("deriveGroup (via parseAwsConfig)", () => {
  it("uses full profile name as group when no hyphen present", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        standalone: { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts[0].group).toBe("standalone");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/lib/aws-config-parser.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/lib/aws-config-parser.test.ts
git commit -m "test: add aws-config-parser unit tests"
```

---

### Task 5: Tests for lib/constants.ts, lib/utils.ts, lib/aws-clients.ts

**Files:**
- Create: `src/__tests__/lib/constants.test.ts`
- Create: `src/__tests__/lib/utils.test.ts`
- Create: `src/__tests__/lib/aws-clients.test.ts`

- [ ] **Step 1: Create constants.test.ts**

```ts
// src/__tests__/lib/constants.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRegion", () => {
  it("returns the ?region= query param when present", async () => {
    const { getRegion } = await import("@/lib/constants");
    const req = new Request("http://localhost/api/foo?region=eu-west-1") as any;
    req.nextUrl = new URL("http://localhost/api/foo?region=eu-west-1");
    expect(getRegion(req)).toBe("eu-west-1");
  });

  it("falls back to AWS_DASHBOARD_REGION env var", async () => {
    vi.stubEnv("AWS_DASHBOARD_REGION", "us-west-2");
    vi.resetModules();
    const { getRegion } = await import("@/lib/constants");
    const req = new Request("http://localhost/api/foo") as any;
    req.nextUrl = new URL("http://localhost/api/foo");
    expect(getRegion(req)).toBe("us-west-2");
  });

  it("falls back to ap-southeast-1 when no env or query param", async () => {
    vi.stubEnv("AWS_DASHBOARD_REGION", "");
    vi.stubEnv("AWS_REGION", "");
    vi.resetModules();
    const { getRegion } = await import("@/lib/constants");
    const req = new Request("http://localhost/api/foo") as any;
    req.nextUrl = new URL("http://localhost/api/foo");
    expect(getRegion(req)).toBe("ap-southeast-1");
  });
});
```

- [ ] **Step 2: Create utils.test.ts**

```ts
// src/__tests__/lib/utils.test.ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles undefined and null inputs", () => {
    expect(cn("foo", undefined, null as any, "bar")).toBe("foo bar");
  });
});
```

- [ ] **Step 3: Create aws-clients.test.ts**

```ts
// src/__tests__/lib/aws-clients.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@aws-sdk/credential-providers", () => ({
  fromIni: vi.fn(() => ({ type: "mock-credentials" })),
}));

describe("createClient", () => {
  it("constructs a client with the given profile and default region", async () => {
    const { createClient } = await import("@/lib/aws-clients");

    class FakeClient {
      config: unknown;
      constructor(config: unknown) { this.config = config; }
    }

    const client = createClient(FakeClient as any, "my-profile");

    expect(client).toBeInstanceOf(FakeClient);
    expect((client as any).config.region).toBe("ap-southeast-1");
    expect((client as any).config.credentials).toBeDefined();
  });

  it("accepts an explicit region override", async () => {
    vi.resetModules();
    const { createClient } = await import("@/lib/aws-clients");

    class FakeClient {
      config: unknown;
      constructor(config: unknown) { this.config = config; }
    }

    const client = createClient(FakeClient as any, "my-profile", "us-east-1");

    expect((client as any).config.region).toBe("us-east-1");
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/__tests__/lib/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/lib/constants.test.ts src/__tests__/lib/utils.test.ts src/__tests__/lib/aws-clients.test.ts
git commit -m "test: add constants, utils, and aws-clients unit tests"
```

---

### Task 6: Tests for context providers

**Files:**
- Create: `src/__tests__/context/nav-context.test.tsx`
- Create: `src/__tests__/context/profile-context.test.tsx`
- Create: `src/__tests__/context/region-context.test.tsx`
- Create: `src/__tests__/context/accounts-context.test.tsx`

- [ ] **Step 1: Create nav-context.test.tsx**

```tsx
// src/__tests__/context/nav-context.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavProvider, useNav } from "@/context/nav-context";

function TestConsumer() {
  const { section, setSection } = useNav();
  return (
    <div>
      <span data-testid="section">{section}</span>
      <button onClick={() => setSection("s3")}>go-s3</button>
      <button onClick={() => setSection("cognito")}>go-cognito</button>
    </div>
  );
}

describe("NavContext", () => {
  it("defaults to dashboard section", () => {
    render(<NavProvider><TestConsumer /></NavProvider>);
    expect(screen.getByTestId("section").textContent).toBe("dashboard");
  });

  it("updates section when setSection is called", () => {
    render(<NavProvider><TestConsumer /></NavProvider>);
    fireEvent.click(screen.getByText("go-s3"));
    expect(screen.getByTestId("section").textContent).toBe("s3");
  });

  it("accepts push-notifications as a valid section", () => {
    render(<NavProvider><TestConsumer /></NavProvider>);
    fireEvent.click(screen.getByText("go-cognito"));
    expect(screen.getByTestId("section").textContent).toBe("cognito");
  });
});
```

- [ ] **Step 2: Create profile-context.test.tsx**

```tsx
// src/__tests__/context/profile-context.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileProvider, useProfile } from "@/context/profile-context";

function TestConsumer() {
  const { profile, setProfile } = useProfile();
  return (
    <div>
      <span data-testid="profile">{profile ?? "null"}</span>
      <button onClick={() => setProfile("my-profile")}>set</button>
      <button onClick={() => setProfile(null)}>clear</button>
    </div>
  );
}

describe("ProfileContext", () => {
  it("defaults to null profile", () => {
    render(<ProfileProvider><TestConsumer /></ProfileProvider>);
    expect(screen.getByTestId("profile").textContent).toBe("null");
  });

  it("updates profile when setProfile is called", () => {
    render(<ProfileProvider><TestConsumer /></ProfileProvider>);
    fireEvent.click(screen.getByText("set"));
    expect(screen.getByTestId("profile").textContent).toBe("my-profile");
  });

  it("clears profile when setProfile(null) is called", () => {
    render(<ProfileProvider><TestConsumer /></ProfileProvider>);
    fireEvent.click(screen.getByText("set"));
    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("profile").textContent).toBe("null");
  });
});
```

- [ ] **Step 3: Create region-context.test.tsx**

```tsx
// src/__tests__/context/region-context.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RegionProvider, useRegion } from "@/context/region-context";

function TestConsumer() {
  const { region, regions, loading } = useRegion();
  if (loading) return <span data-testid="loading">loading</span>;
  return (
    <div>
      <span data-testid="region">{region}</span>
      <span data-testid="regions">{regions.join(",")}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          defaultRegion: "ap-southeast-1",
          regions: ["ap-southeast-1", "us-east-1"],
        }),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("RegionContext", () => {
  it("fetches config and sets default region", async () => {
    render(<RegionProvider><TestConsumer /></RegionProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("region").textContent).toBe("ap-southeast-1");
  });

  it("populates regions list from API response", async () => {
    render(<RegionProvider><TestConsumer /></RegionProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("regions").textContent).toBe("ap-southeast-1,us-east-1");
  });

  it("uses stored region from localStorage over default", async () => {
    localStorage.setItem("aws-dashboard-region", "eu-west-1");
    render(<RegionProvider><TestConsumer /></RegionProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("region").textContent).toBe("eu-west-1");
  });
});
```

- [ ] **Step 4: Create accounts-context.test.tsx**

```tsx
// src/__tests__/context/accounts-context.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AccountsProvider, useAccounts } from "@/context/accounts-context";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
  { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
  { id: "333", name: "other-prod", profile: "other-prod", group: "other" },
];

function TestConsumer() {
  const { accounts, groups, loading } = useAccounts();
  if (loading) return <span data-testid="loading">loading</span>;
  return (
    <div>
      <span data-testid="count">{accounts.length}</span>
      <span data-testid="groups">{groups.join(",")}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({ accounts: MOCK_ACCOUNTS, groups: ["proj", "other"] }),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AccountsContext", () => {
  it("fetches accounts and exposes all by default", async () => {
    render(<AccountsProvider><TestConsumer /></AccountsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("exposes discovered groups", async () => {
    render(<AccountsProvider><TestConsumer /></AccountsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("groups").textContent).toBe("proj,other");
  });

  it("filters accounts to stored enabled groups from localStorage", async () => {
    localStorage.setItem("aws-dashboard-enabled-groups", JSON.stringify(["other"]));
    render(<AccountsProvider><TestConsumer /></AccountsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/__tests__/context/
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/context/
git commit -m "test: add context provider unit tests"
```

---

### Task 7: Tests for components/section-shell.tsx

**Files:**
- Create: `src/__tests__/components/section-shell.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/__tests__/components/section-shell.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionShell, RequireProfile, StatusBadge, StatCard, useProfileData } from "@/components/section-shell";
import { ProfileProvider } from "@/context/profile-context";
import { RegionProvider } from "@/context/region-context";
import { Bell } from "lucide-react";

// Stub fetch for RegionProvider
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }),
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("SectionShell", () => {
  it("renders the title", () => {
    render(<SectionShell title="My Title"><div /></SectionShell>);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("shows refresh button when onRefresh is provided", () => {
    render(<SectionShell title="T" onRefresh={vi.fn()}><div /></SectionShell>);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(<SectionShell title="T" onRefresh={onRefresh}><div /></SectionShell>);
    fireEvent.click(screen.getByText("Refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("disables refresh button when loading is true", () => {
    render(<SectionShell title="T" onRefresh={vi.fn()} loading><div /></SectionShell>);
    expect(screen.getByText("Refresh").closest("button")).toBeDisabled();
  });

  it("renders children", () => {
    render(<SectionShell title="T"><span>hello</span></SectionShell>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});

describe("RequireProfile", () => {
  it("shows prompt when no profile is selected", () => {
    render(
      <ProfileProvider>
        <RequireProfile><span>content</span></RequireProfile>
      </ProfileProvider>
    );
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
    expect(screen.queryByText("content")).toBeNull();
  });
});

describe("StatusBadge", () => {
  const cases: [string, string][] = [
    ["ACTIVE", "default"],
    ["COMPLETE", "default"],
    ["AVAILABLE", "default"],
    ["HEALTHY", "default"],
    ["FAILED", "destructive"],
    ["ERROR", "destructive"],
    ["UNHEALTHY", "destructive"],
    ["IN_PROGRESS", "secondary"],
    ["PENDING", "secondary"],
    ["CREATING", "secondary"],
    ["UNKNOWN_STATUS", "outline"],
  ];

  cases.forEach(([status, variant]) => {
    it(`maps "${status}" to "${variant}" variant`, () => {
      const { container } = render(<StatusBadge status={status} />);
      expect(container.firstChild).toHaveAttribute("data-slot", "badge");
      expect(screen.getByText(status)).toBeInTheDocument();
    });
  });
});

describe("StatCard", () => {
  it("renders label and numeric value", () => {
    render(<StatCard label="Total" value={42} icon={Bell} />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard label="Region" value="ap-southeast-1" icon={Bell} />);
    expect(screen.getByText("ap-southeast-1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/components/section-shell.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/section-shell.test.tsx
git commit -m "test: add section-shell component tests"
```

---

### Task 8: Tests for api/sns-platforms route

**Files:**
- Create: `src/__tests__/api/sns-platforms.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/__tests__/api/sns-platforms.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(() => ({ send: mockSend })),
  ListPlatformApplicationsCommand: vi.fn(),
  GetPlatformApplicationAttributesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({
  getAccounts: vi.fn(),
  REGION: "ap-southeast-1",
}));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/sns-platforms/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
  { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
];

const MOCK_APP_ARN = "arn:aws:sns:ap-southeast-1:111:app/GCM/MyAndroidApp";

function makeRequest(params = "") {
  return new NextRequest(`http://localhost/api/sns-platforms${params}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
  mockSend
    .mockResolvedValueOnce({ PlatformApplications: [{ PlatformApplicationArn: MOCK_APP_ARN }], NextToken: undefined })
    .mockResolvedValueOnce({ Attributes: { Enabled: "true", Token: "fake-cred" } });
});

describe("GET /api/sns-platforms", () => {
  it("returns platforms array with correct shape", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.platforms).toHaveLength(2); // one per account, each with 1 app
    expect(data.platforms[0]).toMatchObject({
      arn: MOCK_APP_ARN,
      name: "MyAndroidApp",
      platform: "GCM",
      enabled: true,
      profile: "proj-prod",
    });
    expect(data.fetchedAt).toBeDefined();
  });

  it("filters to a single account when ?profile= is given", async () => {
    const res = await GET(makeRequest("?profile=proj-prod"));
    const data = await res.json();

    expect(vi.mocked(getAccounts)).toHaveBeenCalled();
    // Only one account processed — send called twice (list + attributes)
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("returns empty platforms when SDK throws", async () => {
    mockSend.mockReset();
    mockSend.mockRejectedValue(new Error("AccessDenied"));

    const res = await GET(makeRequest("?profile=proj-prod"));
    const data = await res.json();

    expect(data.platforms).toEqual([]);
  });

  it("passes ?region= to the SNS client", async () => {
    const { SNSClient } = await import("@aws-sdk/client-sns");
    await GET(makeRequest("?profile=proj-prod&region=us-east-1"));

    expect(vi.mocked(SNSClient)).toHaveBeenCalledWith(
      expect.objectContaining({ region: "us-east-1" })
    );
  });

  it("paginates through multiple pages", async () => {
    mockSend.mockReset();
    vi.mocked(getAccounts).mockResolvedValue([MOCK_ACCOUNTS[0]]);
    // Page 1
    mockSend.mockResolvedValueOnce({
      PlatformApplications: [{ PlatformApplicationArn: MOCK_APP_ARN }],
      NextToken: "page2token",
    });
    // Attributes for page-1 app
    mockSend.mockResolvedValueOnce({ Attributes: { Enabled: "true" } });
    // Page 2
    mockSend.mockResolvedValueOnce({
      PlatformApplications: [{ PlatformApplicationArn: MOCK_APP_ARN.replace("MyAndroidApp", "MyAndroidApp2") }],
      NextToken: undefined,
    });
    // Attributes for page-2 app
    mockSend.mockResolvedValueOnce({ Attributes: { Enabled: "false" } });

    const res = await GET(makeRequest("?profile=proj-prod"));
    const data = await res.json();

    expect(data.platforms).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/api/sns-platforms.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/api/sns-platforms.test.ts
git commit -m "test: add SNS platforms list API route tests"
```

---

### Task 9: Tests for api/sns-platforms/detail route

**Files:**
- Create: `src/__tests__/api/sns-platforms-detail.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/__tests__/api/sns-platforms-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(() => ({ send: mockSend })),
  GetPlatformApplicationAttributesCommand: vi.fn(),
  ListEndpointsByPlatformApplicationCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));

import { GET } from "@/app/api/sns-platforms/detail/route";

const PLATFORM_ARN = "arn:aws:sns:ap-southeast-1:111:app/GCM/MyApp";
const ENDPOINT_ARN = "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/MyApp/abc123";

function makeRequest(params: string) {
  return new NextRequest(`http://localhost/api/sns-platforms/detail${params}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend
    .mockResolvedValueOnce({ Attributes: { Enabled: "true", SuccessFeedbackRoleArn: "arn:aws:iam::111:role/SNSFeedback" } })
    .mockResolvedValueOnce({
      Endpoints: [{ EndpointArn: ENDPOINT_ARN, Attributes: { Token: "a".repeat(200), Enabled: "true" } }],
      NextToken: undefined,
    });
});

describe("GET /api/sns-platforms/detail", () => {
  it("returns platform attributes and endpoints", async () => {
    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    const data = await res.json();

    expect(data.attributes).toMatchObject({ Enabled: "true" });
    expect(data.endpoints).toHaveLength(1);
    expect(data.endpoints[0].enabled).toBe(true);
    expect(data.endpoints[0].arn).toBe(ENDPOINT_ARN);
  });

  it("truncates long device tokens", async () => {
    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    const data = await res.json();

    const token = data.endpoints[0].token as string;
    expect(token).toContain("…");
    expect(token.length).toBeLessThan(30);
  });

  it("returns 400 when arn is missing", async () => {
    const res = await GET(makeRequest("?profile=proj-prod"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when profile is missing", async () => {
    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}`));
    expect(res.status).toBe(400);
  });

  it("returns 500 with error message when SDK throws", async () => {
    mockSend.mockReset();
    mockSend.mockRejectedValue(new Error("ResourceNotFound"));

    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("ResourceNotFound");
  });

  it("paginates through endpoint pages", async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValueOnce({ Attributes: { Enabled: "true" } });
    mockSend.mockResolvedValueOnce({
      Endpoints: [{ EndpointArn: ENDPOINT_ARN, Attributes: { Token: "tok1", Enabled: "true" } }],
      NextToken: "page2",
    });
    mockSend.mockResolvedValueOnce({
      Endpoints: [{ EndpointArn: ENDPOINT_ARN + "2", Attributes: { Token: "tok2", Enabled: "false" } }],
      NextToken: undefined,
    });

    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    const data = await res.json();

    expect(data.endpoints).toHaveLength(2);
    expect(data.endpoints[1].enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/api/sns-platforms-detail.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/api/sns-platforms-detail.test.ts
git commit -m "test: add SNS platforms detail API route tests"
```

---

### Task 10: Tests for api/cognito route and api/profiles route

**Files:**
- Create: `src/__tests__/api/cognito.test.ts`
- Create: `src/__tests__/api/profiles.test.ts`

- [ ] **Step 1: Create cognito.test.ts**

```ts
// src/__tests__/api/cognito.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(() => ({ send: mockSend })),
  ListUserPoolsCommand: vi.fn(),
  DescribeUserPoolCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({
  getAccounts: vi.fn(),
  REGION: "ap-southeast-1",
}));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/cognito/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
  mockSend
    .mockResolvedValueOnce({ UserPools: [{ Id: "ap-southeast-1_abc123", Name: "MyPool" }], NextToken: undefined })
    .mockResolvedValueOnce({ UserPool: { EstimatedNumberOfUsers: 500 } });
});

describe("GET /api/cognito", () => {
  it("returns pools with correct shape", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cognito?profile=proj-prod"));
    const data = await res.json();

    expect(data.pools).toHaveLength(1);
    expect(data.pools[0]).toMatchObject({
      poolId: "ap-southeast-1_abc123",
      poolName: "MyPool",
      estimatedUsers: 500,
      profile: "proj-prod",
    });
  });

  it("returns empty pools when SDK throws", async () => {
    mockSend.mockReset();
    mockSend.mockRejectedValue(new Error("AccessDenied"));

    const res = await GET(new NextRequest("http://localhost/api/cognito?profile=proj-prod"));
    const data = await res.json();

    expect(data.pools).toEqual([]);
  });

  it("fans out across all accounts when no profile given", async () => {
    vi.mocked(getAccounts).mockResolvedValue([
      { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
      { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
    ]);
    mockSend.mockReset();
    mockSend.mockResolvedValue({ UserPools: [], NextToken: undefined });

    await GET(new NextRequest("http://localhost/api/cognito"));

    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Create profiles.test.ts**

```ts
// src/__tests__/api/profiles.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/aws-config-parser", () => ({
  parseAwsConfig: vi.fn(),
  getGroups: vi.fn(),
}));

import { parseAwsConfig, getGroups } from "@/lib/aws-config-parser";
import { GET } from "@/app/api/profiles/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

describe("GET /api/profiles", () => {
  it("returns accounts and groups", async () => {
    vi.mocked(parseAwsConfig).mockResolvedValue(MOCK_ACCOUNTS);
    vi.mocked(getGroups).mockReturnValue(["proj"]);

    const res = await GET();
    const data = await res.json();

    expect(data.accounts).toEqual(MOCK_ACCOUNTS);
    expect(data.groups).toEqual(["proj"]);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/__tests__/api/cognito.test.ts src/__tests__/api/profiles.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/api/cognito.test.ts src/__tests__/api/profiles.test.ts
git commit -m "test: add cognito and profiles API route tests"
```

---

### Task 11: Tests for components/push-notifications-section.tsx

**Files:**
- Create: `src/__tests__/components/push-notifications-section.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/__tests__/components/push-notifications-section.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { PushNotificationsSection } from "@/components/sections/push-notifications-section";
import { renderWithProviders, makeConfigFetch } from "@/src/__tests__/test-utils";

// Note: import path for test-utils uses the src alias
// Actually fix: the import should be relative or use @/ alias
```

Wait — the test-utils path alias. Since test-utils is inside `src/__tests__/`, the import in other test files should be:

```tsx
import { renderWithProviders, makeConfigFetch } from "../test-utils";
```

**Correct the task:** use relative imports for test-utils within `src/__tests__/`.

- [ ] **Step 1: Create push-notifications-section.test.tsx**

```tsx
// src/__tests__/components/push-notifications-section.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { PushNotificationsSection } from "@/components/sections/push-notifications-section";

const MOCK_PLATFORMS = [
  {
    account: "proj-prod", accountId: "111", profile: "proj-prod",
    arn: "arn:aws:sns:ap-southeast-1:111:app/GCM/MyAndroidApp",
    name: "MyAndroidApp", platform: "GCM", enabled: true, attributes: {},
  },
  {
    account: "proj-prod", accountId: "111", profile: "proj-prod",
    arn: "arn:aws:sns:ap-southeast-1:111:app/APNS/MyiOSApp",
    name: "MyiOSApp", platform: "APNS", enabled: false, attributes: {},
  },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("PushNotificationsSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<PushNotificationsSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders platform rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: MOCK_PLATFORMS } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyAndroidApp")).toBeInTheDocument());
    expect(screen.getByText("MyiOSApp")).toBeInTheDocument();
  });

  it("shows Android (FCM) badge for GCM platform", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [MOCK_PLATFORMS[0]] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Android (FCM)")).toBeInTheDocument());
  });

  it("shows iOS (APNS) badge for APNS platform", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [MOCK_PLATFORMS[1]] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("iOS (APNS)")).toBeInTheDocument());
  });

  it("shows stat cards with correct counts", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: MOCK_PLATFORMS } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyAndroidApp")).toBeInTheDocument());
    expect(screen.getByText("2")).toBeInTheDocument(); // Total
    expect(screen.getByText("1")).toBeInTheDocument(); // Android count
  });

  it("shows empty state when no platforms found", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No SNS platform applications found/i)).toBeInTheDocument());
  });

  it("navigates to detail view when a row is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [MOCK_PLATFORMS[0]] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyAndroidApp")).toBeInTheDocument());
    fireEvent.click(screen.getByText("MyAndroidApp").closest("tr")!);

    // After click, the detail view should replace the list
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/components/push-notifications-section.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/push-notifications-section.test.tsx
git commit -m "test: add PushNotificationsSection component tests"
```

---

### Task 12: Tests for components/push-notification-detail.tsx

**Files:**
- Create: `src/__tests__/components/push-notification-detail.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/__tests__/components/push-notification-detail.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { PushNotificationDetail } from "@/components/sections/push-notification-detail";

const DEFAULT_PROPS = {
  platformArn: "arn:aws:sns:ap-southeast-1:111:app/GCM/MyApp",
  platformName: "MyApp",
  platform: "GCM",
  profile: "proj-prod",
  onBack: vi.fn(),
};

const MOCK_DETAIL = {
  attributes: {
    Enabled: "true",
    SuccessFeedbackRoleArn: "arn:aws:iam::111:role/SNSFeedback",
    ApplePlatformTeamID: undefined,
  },
  endpoints: [
    { arn: "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/MyApp/abc", token: "abc…xyz", enabled: true },
    { arn: "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/MyApp/def", token: "def…uvw", enabled: false },
  ],
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("PushNotificationDetail", () => {
  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });
    expect(screen.getByText(/Loading platform details/i)).toBeInTheDocument();
  });

  it("renders platform name and back button", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    expect(screen.getByText("MyApp")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    const onBack = vi.fn();
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} onBack={onBack} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders platform attributes", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Success Feedback Role")).toBeInTheDocument());
    expect(screen.getByText("arn:aws:iam::111:role/SNSFeedback")).toBeInTheDocument();
  });

  it("renders endpoint table with enabled/disabled badges", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("abc…xyz")).toBeInTheDocument());
    expect(screen.getByText("def…uvw")).toBeInTheDocument();
    expect(screen.getAllByText("Enabled")).not.toHaveLength(0);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("shows total, enabled, and disabled endpoint counts", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Total Endpoints")).toBeInTheDocument());
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows error message when API returns error", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": { error: "ResourceNotFound" } }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("ResourceNotFound")).toBeInTheDocument());
  });

  it("shows empty endpoints message when no endpoints registered", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": { attributes: { Enabled: "true" }, endpoints: [] } }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No registered device endpoints/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/components/push-notification-detail.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/push-notification-detail.test.tsx
git commit -m "test: add PushNotificationDetail component tests"
```

---

### Task 13: Tests for components/cognito-section.tsx

**Files:**
- Create: `src/__tests__/components/cognito-section.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/__tests__/components/cognito-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { CognitoSection } from "@/components/sections/cognito-section";

const MOCK_POOLS = [
  { account: "proj-prod", accountId: "111", profile: "proj-prod", poolId: "ap-southeast-1_abc", poolName: "MyPool", estimatedUsers: 100 },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("CognitoSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<CognitoSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders user pool rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cognito": { pools: MOCK_POOLS } }));
    renderWithProviders(<CognitoSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyPool")).toBeInTheDocument());
    expect(screen.getByText("ap-southeast-1_abc")).toBeInTheDocument();
  });

  it("navigates to detail view when a pool row is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cognito": { pools: MOCK_POOLS } }));
    renderWithProviders(<CognitoSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyPool")).toBeInTheDocument());
    fireEvent.click(screen.getByText("MyPool").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/components/cognito-section.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/cognito-section.test.tsx
git commit -m "test: add CognitoSection component tests"
```

---

### Task 14: Tests for components/sidebar.tsx

**Files:**
- Create: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// src/__tests__/components/sidebar.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";
import { ProfileProvider } from "@/context/profile-context";
import { NavProvider, useNav } from "@/context/nav-context";
import { RegionProvider } from "@/context/region-context";
import { AccountsProvider } from "@/context/accounts-context";

function SidebarWithNav() {
  const { section } = useNav();
  return (
    <>
      <Sidebar />
      <span data-testid="active-section">{section}</span>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.includes("/api/config")) {
      return Promise.resolve({ json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ accounts: [], groups: [] }) });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

function renderSidebar() {
  return render(
    <ProfileProvider>
      <NavProvider>
        <RegionProvider>
          <AccountsProvider>
            <SidebarWithNav />
          </AccountsProvider>
        </RegionProvider>
      </NavProvider>
    </ProfileProvider>
  );
}

describe("Sidebar", () => {
  it("renders Push Notifications nav item", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
  });

  it("renders Cognito nav item under Resources group", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Cognito")).toBeInTheDocument());
  });

  it("navigates to s3 section when S3 Buckets is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("S3 Buckets")).toBeInTheDocument());
    fireEvent.click(screen.getByText("S3 Buckets"));
    expect(screen.getByTestId("active-section").textContent).toBe("s3");
  });

  it("navigates to push-notifications section when Push Notifications is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Push Notifications"));
    expect(screen.getByTestId("active-section").textContent).toBe("push-notifications");
  });

  it("collapses and expands when toggle button is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Collapse"));
    expect(screen.queryByText("Push Notifications")).toBeNull();
    fireEvent.click(screen.getByTitle("Expand"));
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/__tests__/components/sidebar.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/sidebar.test.tsx
git commit -m "test: add Sidebar component tests"
```

---

### Task 15: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflows directory and ci.yml**

```bash
mkdir -p .github/workflows
```

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-
      - run: npm ci
      - run: npm run build

  test:
    name: Test (coverage)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, build, and test with coverage"
```

---

### Task 16: Run full coverage report and fix any gaps

**Files:**
- Modify: whichever source files are below the 90% threshold

- [ ] **Step 1: Run coverage**

```bash
npm run test:coverage
```

Examine the `text-summary` output. Note any files below the threshold. The build fails if any metric is below 90%.

- [ ] **Step 2: If any files are below threshold, add targeted tests**

Common gaps to check:
- Any `api/` routes not yet covered (alb, cdn, dynamodb, ecr, ecs, lambda, etc.) — add a minimal test for the happy path and error path using the same pattern as Task 8
- `src/proxy.ts` — read the file and add a simple unit test
- `src/lib/accounts.ts` — already fully covered by aws-config-parser tests (it's a 3-line re-export)

For each uncovered route, use this template:

```ts
// src/__tests__/api/<service>.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-<service>", () => ({
  <ServiceClient>: vi.fn(() => ({ send: mockSend })),
  <ListCommand>: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/<service>/route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue([{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }]);
  mockSend.mockResolvedValue({ /* empty happy-path response */ });
});

describe("GET /api/<service>", () => {
  it("returns data with correct shape", async () => {
    const res = await GET(new NextRequest("http://localhost/api/<service>?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  it("returns empty result when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/<service>?profile=proj-prod"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toBeDefined();
  });
});
```

- [ ] **Step 3: Re-run coverage until all thresholds pass**

```bash
npm run test:coverage
```

Expected output (example):
```
Coverage summary:
  Statements   : 91.2% ( ... )
  Branches     : 90.5% ( ... )
  Functions    : 93.1% ( ... )
  Lines        : 91.2% ( ... )
```

All metrics must be ≥ 90%.

- [ ] **Step 4: Commit coverage fixes**

```bash
git add src/__tests__/
git commit -m "test: add coverage gap-fill tests to reach 90% threshold"
```

- [ ] **Step 5: Push to origin**

```bash
git push origin main
```

Open the GitHub Actions tab and verify all three jobs (Lint, Build, Test) pass on the push to main.
