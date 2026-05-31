// src/__tests__/api/config.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/constants", () => ({ REGION: "ap-southeast-1", getRegion: vi.fn(() => "ap-southeast-1") }));

import { GET } from "@/app/api/config/route";

describe("GET /api/config", () => {
  it("returns defaultRegion and list of regions", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.defaultRegion).toBe("ap-southeast-1");
    expect(Array.isArray(data.regions)).toBe(true);
    expect(data.regions.length).toBeGreaterThan(0);
    expect(data.regions).toContain("ap-southeast-1");
    expect(data.regions).toContain("us-east-1");
  });
});
