// src/__tests__/api/sns-platforms.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(function () { return { send: mockSend }; }),
  ListPlatformApplicationsCommand: vi.fn(function (input: unknown) {
    Object.assign(this as object, { _tag: "List", input });
  }),
  GetPlatformApplicationAttributesCommand: vi.fn(function (input: unknown) {
    Object.assign(this as object, { _tag: "Attrs", input });
  }),
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
  // Use mockResolvedValue (not Once) so concurrent fan-out calls all succeed
  // regardless of call order. Each account creates its own SNSClient but they
  // share the same mockSend, so list and attrs calls interleave when Promise.all
  // fans out across accounts in parallel.
  mockSend.mockImplementation((cmd: { _tag?: string }) => {
    if (cmd._tag === "List") {
      return Promise.resolve({ PlatformApplications: [{ PlatformApplicationArn: MOCK_APP_ARN }], NextToken: undefined });
    }
    // Attrs
    return Promise.resolve({ Attributes: { Enabled: "true", Token: "fake-cred" } });
  });
});

describe("GET /api/sns-platforms", () => {
  it("returns platforms array with correct shape", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();

    expect(data.platforms).toHaveLength(2);
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

    expect(data.platforms).toHaveLength(1);
    expect(data.platforms[0].profile).toBe("proj-prod");
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
    const ARN2 = MOCK_APP_ARN.replace("MyAndroidApp", "MyAndroidApp2");
    let listCallCount = 0;
    mockSend.mockImplementation((cmd: { _tag?: string }) => {
      if (cmd._tag === "List") {
        listCallCount++;
        if (listCallCount === 1) {
          return Promise.resolve({ PlatformApplications: [{ PlatformApplicationArn: MOCK_APP_ARN }], NextToken: "page2token" });
        }
        return Promise.resolve({ PlatformApplications: [{ PlatformApplicationArn: ARN2 }], NextToken: undefined });
      }
      // Attrs
      return Promise.resolve({ Attributes: { Enabled: "true" } });
    });

    const res = await GET(makeRequest("?profile=proj-prod"));
    const data = await res.json();

    expect(data.platforms).toHaveLength(2);
  });
});
