// src/__tests__/api/vpc.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: vi.fn(function () { return { send: mockSend }; }),
  DescribeVpcsCommand: vi.fn(),
  DescribeSubnetsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/vpc/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/vpc", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/vpc"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/vpc?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns VPCs with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        Vpcs: [
          {
            VpcId: "vpc-12345",
            Tags: [{ Key: "Name", Value: "main-vpc" }],
            CidrBlock: "10.0.0.0/16",
            State: "available",
            IsDefault: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        Subnets: [
          { SubnetId: "subnet-1" },
          { SubnetId: "subnet-2" },
          { SubnetId: "subnet-3" },
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/vpc?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.vpcs).toHaveLength(1);
    expect(data.vpcs[0]).toMatchObject({
      vpcId: "vpc-12345",
      name: "main-vpc",
      cidr: "10.0.0.0/16",
      state: "available",
      isDefault: false,
      subnetCount: 3,
    });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/vpc?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles VPC with no Name tag", async () => {
    mockSend
      .mockResolvedValueOnce({
        Vpcs: [{ VpcId: "vpc-99999", Tags: [], CidrBlock: "172.16.0.0/12", State: "available", IsDefault: true }],
      })
      .mockResolvedValueOnce({ Subnets: [] });

    const res = await GET(new NextRequest("http://localhost/api/vpc?profile=proj-prod"));
    const data = await res.json();
    expect(data.vpcs[0].name).toBe("");
    expect(data.vpcs[0].isDefault).toBe(true);
    expect(data.vpcs[0].subnetCount).toBe(0);
  });

  it("handles VPCs with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        Vpcs: [{ VpcId: undefined, Tags: undefined, CidrBlock: undefined, State: undefined, IsDefault: undefined }],
      })
      .mockResolvedValueOnce({ Subnets: undefined });

    const res = await GET(new NextRequest("http://localhost/api/vpc?profile=proj-prod"));
    const data = await res.json();
    expect(data.vpcs[0].vpcId).toBe("");
    expect(data.vpcs[0].name).toBe("");
    expect(data.vpcs[0].cidr).toBe("");
    expect(data.vpcs[0].state).toBe("");
    expect(data.vpcs[0].isDefault).toBe(false);
    expect(data.vpcs[0].subnetCount).toBe(0);
  });

  it("handles null Vpcs response", async () => {
    mockSend.mockResolvedValueOnce({ Vpcs: undefined });
    const res = await GET(new NextRequest("http://localhost/api/vpc?profile=proj-prod"));
    const data = await res.json();
    expect(data.vpcs).toEqual([]);
  });
});
