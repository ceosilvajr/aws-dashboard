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
