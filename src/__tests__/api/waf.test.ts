// src/__tests__/api/waf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-wafv2", () => ({
  WAFV2Client: vi.fn(function () { return { send: mockSend }; }),
  ListWebACLsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/waf/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/waf", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/waf"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/waf?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns ACLs with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      WebACLs: [
        {
          Id: "acl-id-123",
          Name: "my-waf-acl",
          ARN: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-123",
        },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/waf?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.acls).toHaveLength(1);
    expect(data.acls[0]).toMatchObject({
      id: "acl-id-123",
      name: "my-waf-acl",
      arn: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-123",
    });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/waf?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles empty ACL list", async () => {
    mockSend.mockResolvedValueOnce({ WebACLs: [] });
    const res = await GET(new NextRequest("http://localhost/api/waf?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.acls).toEqual([]);
  });

  it("handles ACLs with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      WebACLs: [{ Id: undefined, Name: undefined, ARN: undefined }],
    });

    const res = await GET(new NextRequest("http://localhost/api/waf?profile=proj-prod"));
    const data = await res.json();
    expect(data.acls[0].id).toBe("");
    expect(data.acls[0].name).toBe("");
    expect(data.acls[0].arn).toBe("");
  });

  it("handles null WebACLs response", async () => {
    mockSend.mockResolvedValueOnce({ WebACLs: undefined });
    const res = await GET(new NextRequest("http://localhost/api/waf?profile=proj-prod"));
    const data = await res.json();
    expect(data.acls).toEqual([]);
  });
});
