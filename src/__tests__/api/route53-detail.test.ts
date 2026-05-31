// src/__tests__/api/route53-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-route-53", () => ({
  Route53Client: vi.fn(function () { return { send: mockSend }; }),
  GetHostedZoneCommand: vi.fn(),
  ListResourceRecordSetsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/route53/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/route53/detail", () => {
  it("returns 400 when profile or zoneId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/route53/detail"));
    expect(res.status).toBe(400);
  });

  it("returns zone detail with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        HostedZone: {
          Id: "/hostedzone/Z1234567890",
          Name: "example.com.",
          Config: { PrivateZone: false },
          ResourceRecordSetCount: 5,
        },
        VPCs: [],
      })
      .mockResolvedValueOnce({
        ResourceRecordSets: [
          {
            Name: "example.com.",
            Type: "A",
            TTL: 300,
            ResourceRecords: [{ Value: "1.2.3.4" }],
          },
          {
            Name: "www.example.com.",
            Type: "CNAME",
            AliasTarget: { DNSName: "abc123.cloudfront.net", EvaluateTargetHealth: false },
          },
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/route53/detail?profile=proj-prod&zoneId=Z1234567890"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      id: "Z1234567890",
      name: "example.com.",
      type: "Public",
      recordCount: 5,
    });
    expect(data.records).toHaveLength(2);
    expect(data.records[0]).toMatchObject({ name: "example.com.", type: "A", ttl: 300, values: ["1.2.3.4"] });
    expect(data.records[1].values[0]).toContain("ALIAS");
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("NoSuchHostedZone"));
    const res = await GET(new NextRequest("http://localhost/api/route53/detail?profile=proj-prod&zoneId=Z9999999999"));
    expect(res.status).toBe(500);
  });

  it("handles null/undefined fields in zone", async () => {
    mockSend
      .mockResolvedValueOnce({
        HostedZone: {
          Id: undefined, // null Id
          Name: undefined, // null Name
          Config: undefined, // null Config
          ResourceRecordSetCount: undefined, // null count
        },
        VPCs: undefined, // null VPCs
      })
      .mockResolvedValueOnce({ ResourceRecordSets: [] });

    const res = await GET(new NextRequest("http://localhost/api/route53/detail?profile=proj-prod&zoneId=Z123"));
    const data = await res.json();
    expect(data.id).toBe(""); // undefined → ""
    expect(data.name).toBe(""); // undefined → ""
    expect(data.type).toBe("Public"); // undefined Config → Public
    expect(data.recordCount).toBe(0); // undefined → 0
    expect(data.vpcs).toHaveLength(0); // undefined VPCs → []
  });

  it("handles records with neither ResourceRecords nor AliasTarget", async () => {
    mockSend
      .mockResolvedValueOnce({
        HostedZone: {
          Id: "/hostedzone/Z123",
          Name: "example.com.",
          Config: { PrivateZone: false },
          ResourceRecordSetCount: 1,
        },
        VPCs: [],
      })
      .mockResolvedValueOnce({
        ResourceRecordSets: [
          // Record with no ResourceRecords AND no AliasTarget
          { Name: "example.com.", Type: "SOA", TTL: 900, ResourceRecords: undefined, AliasTarget: undefined },
          // Record with null Values in ResourceRecords
          { Name: "test.example.com.", Type: "TXT", TTL: 60, ResourceRecords: [{ Value: undefined }] },
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/route53/detail?profile=proj-prod&zoneId=Z123"));
    const data = await res.json();
    expect(data.records).toHaveLength(2);
    expect(data.records[0].values).toEqual([]); // no values when neither field present
    expect(data.records[1].values).toEqual([""]); // undefined Value becomes ""
  });

  it("handles private zone with associated VPCs", async () => {
    mockSend
      .mockResolvedValueOnce({
        HostedZone: {
          Id: "/hostedzone/Z9876543210",
          Name: "internal.example.com.",
          Config: { PrivateZone: true },
          ResourceRecordSetCount: 3,
        },
        VPCs: [
          { VPCId: "vpc-123", VPCRegion: "ap-southeast-1" },
          { VPCId: "vpc-456", VPCRegion: "us-east-1" },
        ],
      })
      .mockResolvedValueOnce({
        ResourceRecordSets: [
          { Name: "server.internal.example.com.", Type: "A", TTL: 60, ResourceRecords: [{ Value: "10.0.0.1" }] },
          { Name: "service.internal.example.com.", Type: "CNAME", TTL: null, AliasTarget: { DNSName: "internal-alb.region.elb.amazonaws.com", EvaluateTargetHealth: true } },
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/route53/detail?profile=proj-prod&zoneId=Z9876543210"));
    const data = await res.json();
    expect(data.type).toBe("Private");
    expect(data.vpcs).toHaveLength(2);
    expect(data.records).toHaveLength(2);
    // Alias record without ResourceRecords
    expect(data.records[1].values[0]).toContain("ALIAS");
    expect(data.records[0].ttl).toBe(60);
    expect(data.records[1].ttl).toBeNull();
  });
});
