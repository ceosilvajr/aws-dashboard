// src/__tests__/api/cognito.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(function () { return { send: mockSend }; }),
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
