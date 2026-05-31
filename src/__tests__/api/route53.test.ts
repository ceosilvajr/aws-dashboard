// src/__tests__/api/route53.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-route-53", () => ({
  Route53Client: vi.fn(function () { return { send: mockSend }; }),
  ListHostedZonesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/route53/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/route53", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/route53"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/route53?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns zones with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      HostedZones: [
        {
          Id: "/hostedzone/Z1234567890",
          Name: "example.com.",
          Config: { PrivateZone: false },
          ResourceRecordSetCount: 5,
        },
        {
          Id: "/hostedzone/Z9876543210",
          Name: "internal.example.com.",
          Config: { PrivateZone: true },
          ResourceRecordSetCount: 3,
        },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/route53?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.zones).toHaveLength(2);
    expect(data.zones[0]).toMatchObject({
      id: "Z1234567890",
      name: "example.com.",
      type: "Public",
      recordCount: 5,
    });
    expect(data.zones[1]).toMatchObject({
      id: "Z9876543210",
      name: "internal.example.com.",
      type: "Private",
      recordCount: 3,
    });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/route53?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles empty zones list", async () => {
    mockSend.mockResolvedValueOnce({ HostedZones: [] });
    const res = await GET(new NextRequest("http://localhost/api/route53?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.zones).toEqual([]);
  });

  it("handles zones with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      HostedZones: [
        {
          Id: undefined,
          Name: undefined,
          Config: undefined, // no Config means Public by default
          ResourceRecordSetCount: undefined,
        },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/route53?profile=proj-prod"));
    const data = await res.json();
    expect(data.zones[0].id).toBe("");
    expect(data.zones[0].name).toBe("");
    expect(data.zones[0].type).toBe("Public"); // no Config → Public
    expect(data.zones[0].recordCount).toBe(0);
  });
});
