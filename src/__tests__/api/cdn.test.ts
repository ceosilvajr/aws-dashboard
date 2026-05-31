// src/__tests__/api/cdn.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cloudfront", () => ({
  CloudFrontClient: vi.fn(function () { return { send: mockSend }; }),
  ListDistributionsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/cdn/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/cdn", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cdn"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cdn?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns distributions with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      DistributionList: {
        Items: [
          {
            Id: "EABC123",
            DomainName: "abc123.cloudfront.net",
            Aliases: { Items: ["www.example.com"] },
            Status: "Deployed",
            Enabled: true,
            Origins: { Items: [{ DomainName: "my-bucket.s3.amazonaws.com" }] },
          },
        ],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/cdn?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.distributions).toHaveLength(1);
    expect(data.distributions[0]).toMatchObject({
      id: "EABC123",
      domain: "abc123.cloudfront.net",
      aliases: ["www.example.com"],
      status: "Deployed",
      enabled: true,
      origins: ["my-bucket.s3.amazonaws.com"],
    });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/cdn?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles empty distribution list", async () => {
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [] } });
    const res = await GET(new NextRequest("http://localhost/api/cdn?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.distributions).toEqual([]);
  });

  it("handles distribution with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      DistributionList: {
        Items: [
          {
            // All optional fields are undefined/null
            Id: undefined,
            DomainName: undefined,
            Aliases: undefined,
            Status: undefined,
            Enabled: undefined,
            Origins: undefined,
          },
        ],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/cdn?profile=proj-prod"));
    const data = await res.json();
    expect(data.distributions).toHaveLength(1);
    expect(data.distributions[0].id).toBe("");
    expect(data.distributions[0].domain).toBe("");
    expect(data.distributions[0].aliases).toEqual([]);
    expect(data.distributions[0].status).toBe("");
    expect(data.distributions[0].enabled).toBe(false);
    expect(data.distributions[0].origins).toEqual([]);
  });

  it("handles null DistributionList", async () => {
    mockSend.mockResolvedValueOnce({ DistributionList: null });
    const res = await GET(new NextRequest("http://localhost/api/cdn?profile=proj-prod"));
    const data = await res.json();
    expect(data.distributions).toEqual([]);
  });
});
