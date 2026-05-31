// src/__tests__/lib/constants.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getRegion", () => {
  it("returns the ?region= query param when present", async () => {
    const { getRegion } = await import("@/lib/constants");
    const req = { nextUrl: new URL("http://localhost/api/foo?region=eu-west-1") } as { nextUrl: URL };
    expect(getRegion(req)).toBe("eu-west-1");
  });

  it("falls back to AWS_DASHBOARD_REGION env var", async () => {
    vi.stubEnv("AWS_DASHBOARD_REGION", "us-west-2");
    vi.resetModules();
    const { getRegion } = await import("@/lib/constants");
    const req = { nextUrl: new URL("http://localhost/api/foo") } as { nextUrl: URL };
    expect(getRegion(req)).toBe("us-west-2");
  });

  it("falls back to ap-southeast-1 when no env or query param", async () => {
    // Delete env vars so ?? falls through to the hardcoded default.
    // vi.stubEnv("", ...) sets to empty string (truthy for ??), so we delete instead.
    const origDashboard = process.env.AWS_DASHBOARD_REGION;
    const origRegion = process.env.AWS_REGION;
    delete process.env.AWS_DASHBOARD_REGION;
    delete process.env.AWS_REGION;
    vi.resetModules();
    try {
      const { getRegion } = await import("@/lib/constants");
      const req = { nextUrl: new URL("http://localhost/api/foo") } as { nextUrl: URL };
      expect(getRegion(req)).toBe("ap-southeast-1");
    } finally {
      if (origDashboard !== undefined) process.env.AWS_DASHBOARD_REGION = origDashboard;
      if (origRegion !== undefined) process.env.AWS_REGION = origRegion;
    }
  });
});
