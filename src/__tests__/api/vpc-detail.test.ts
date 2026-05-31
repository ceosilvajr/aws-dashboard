// src/__tests__/api/vpc-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-ec2", () => ({
  EC2Client: vi.fn(function () { return { send: mockSend }; }),
  DescribeVpcsCommand: vi.fn(),
  DescribeSubnetsCommand: vi.fn(),
  DescribeRouteTablesCommand: vi.fn(),
  DescribeSecurityGroupsCommand: vi.fn(),
  DescribeNatGatewaysCommand: vi.fn(),
  DescribeVpcAttributeCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/vpc/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/vpc/detail", () => {
  it("returns 400 when required params missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/vpc/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when vpcId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod"));
    expect(res.status).toBe(400);
  });

  it("returns VPC detail with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({ Vpcs: [{ VpcId: "vpc-123", Tags: [{ Key: "Name", Value: "main-vpc" }], CidrBlock: "10.0.0.0/16", State: "available", IsDefault: false }] }) // DescribeVpcs
      .mockResolvedValueOnce({ Subnets: [{ SubnetId: "subnet-1", CidrBlock: "10.0.1.0/24", AvailabilityZone: "ap-southeast-1a", AvailableIpAddressCount: 250, MapPublicIpOnLaunch: true, Tags: [] }] }) // subnets
      .mockResolvedValueOnce({ RouteTables: [{ RouteTableId: "rtb-1", Tags: [], Associations: [], Routes: [{ DestinationCidrBlock: "0.0.0.0/0", GatewayId: "igw-1", State: "active" }] }] }) // route tables
      .mockResolvedValueOnce({ SecurityGroups: [{ GroupId: "sg-1", GroupName: "default", Description: "default VPC security group", IpPermissions: [], IpPermissionsEgress: [{}] }] }) // security groups
      .mockResolvedValueOnce({ NatGateways: [{ NatGatewayId: "nat-1", State: "available", SubnetId: "subnet-1", NatGatewayAddresses: [{ PublicIp: "1.2.3.4" }] }] }) // nat gateways
      .mockResolvedValueOnce({ EnableDnsHostnames: { Value: true } }) // dns hostnames
      .mockResolvedValueOnce({ EnableDnsSupport: { Value: true } }); // dns resolution

    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod&vpcId=vpc-123"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      vpcId: "vpc-123",
      name: "main-vpc",
      cidr: "10.0.0.0/16",
      state: "available",
      dnsHostnames: true,
      dnsResolution: true,
    });
    expect(data.subnets).toHaveLength(1);
    expect(data.routeTables).toHaveLength(1);
    expect(data.securityGroups).toHaveLength(1);
    expect(data.natGateways).toHaveLength(1);
  });

  it("filters out deleted NAT gateways", async () => {
    mockSend
      .mockResolvedValueOnce({ Vpcs: [{ VpcId: "vpc-123", Tags: [], CidrBlock: "10.0.0.0/16", State: "available", IsDefault: false }] })
      .mockResolvedValueOnce({ Subnets: [] })
      .mockResolvedValueOnce({ RouteTables: [] })
      .mockResolvedValueOnce({ SecurityGroups: [] })
      .mockResolvedValueOnce({ NatGateways: [
        { NatGatewayId: "nat-alive", State: "available", SubnetId: "subnet-1", NatGatewayAddresses: [] },
        { NatGatewayId: "nat-dead", State: "deleted", SubnetId: "subnet-1", NatGatewayAddresses: [] },
      ] })
      .mockResolvedValueOnce({ EnableDnsHostnames: { Value: false } })
      .mockResolvedValueOnce({ EnableDnsSupport: { Value: false } });

    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod&vpcId=vpc-123"));
    const data = await res.json();
    expect(data.natGateways).toHaveLength(1);
    expect(data.natGateways[0].id).toBe("nat-alive");
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("InvalidVpcID.NotFound"));
    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod&vpcId=vpc-bad"));
    expect(res.status).toBe(500);
  });

  it("handles route table with IPv6 and prefix destinations", async () => {
    mockSend
      .mockResolvedValueOnce({ Vpcs: [{ VpcId: "vpc-123", Tags: [], CidrBlock: "10.0.0.0/16", State: "available", IsDefault: false }] })
      .mockResolvedValueOnce({ Subnets: [] })
      .mockResolvedValueOnce({ RouteTables: [{
        RouteTableId: "rtb-1",
        Tags: [{ Key: "Name", Value: "main-rt" }],
        Associations: [{ SubnetId: "subnet-1" }],
        Routes: [
          { DestinationIpv6CidrBlock: "::/0", GatewayId: "igw-1", State: "active" },
          { DestinationPrefixListId: "pl-abc123", NatGatewayId: "nat-1", State: "active" },
          { TransitGatewayId: "tgw-1", State: "active" },
          { NetworkInterfaceId: "eni-1", State: "active" },
          { VpcPeeringConnectionId: "pcx-1", State: "active" },
        ],
      }] })
      .mockResolvedValueOnce({ SecurityGroups: [] })
      .mockResolvedValueOnce({ NatGateways: [] })
      .mockResolvedValueOnce({ EnableDnsHostnames: { Value: true } })
      .mockResolvedValueOnce({ EnableDnsSupport: { Value: true } });

    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod&vpcId=vpc-123"));
    const data = await res.json();
    expect(data.routeTables).toHaveLength(1);
    expect(data.routeTables[0].name).toBe("main-rt");
    expect(data.routeTables[0].routes).toHaveLength(5);
  });

  it("handles subnet with Name tag", async () => {
    mockSend
      .mockResolvedValueOnce({ Vpcs: [{ VpcId: "vpc-123", Tags: [], CidrBlock: "10.0.0.0/16", State: "available", IsDefault: false }] })
      .mockResolvedValueOnce({ Subnets: [{
        SubnetId: "subnet-1",
        CidrBlock: "10.0.1.0/24",
        AvailabilityZone: "ap-southeast-1a",
        AvailableIpAddressCount: 250,
        MapPublicIpOnLaunch: false,
        Tags: [{ Key: "Name", Value: "private-1" }],
      }] })
      .mockResolvedValueOnce({ RouteTables: [] })
      .mockResolvedValueOnce({ SecurityGroups: [] })
      .mockResolvedValueOnce({ NatGateways: [] })
      .mockResolvedValueOnce({ EnableDnsHostnames: { Value: false } })
      .mockResolvedValueOnce({ EnableDnsSupport: { Value: false } });

    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod&vpcId=vpc-123"));
    const data = await res.json();
    expect(data.subnets[0].name).toBe("private-1");
  });

  it("handles all null/undefined fields in VPC, subnets, security groups", async () => {
    mockSend
      .mockResolvedValueOnce({ Vpcs: [{ VpcId: "vpc-123", Tags: undefined, CidrBlock: undefined, State: undefined, IsDefault: undefined }] })
      .mockResolvedValueOnce({ Subnets: [{
        SubnetId: undefined,
        CidrBlock: undefined,
        AvailabilityZone: undefined,
        AvailableIpAddressCount: undefined,
        MapPublicIpOnLaunch: undefined,
        Tags: undefined,
      }] })
      .mockResolvedValueOnce({ RouteTables: [{
        RouteTableId: undefined,
        Tags: undefined,
        Associations: undefined,
        Routes: undefined,
      }] })
      .mockResolvedValueOnce({ SecurityGroups: [{
        GroupId: undefined,
        GroupName: undefined,
        Description: undefined,
        IpPermissions: undefined,
        IpPermissionsEgress: undefined,
      }] })
      .mockResolvedValueOnce({ NatGateways: [{
        NatGatewayId: undefined,
        State: "available",
        SubnetId: undefined,
        NatGatewayAddresses: undefined,
      }] })
      .mockResolvedValueOnce({ EnableDnsHostnames: { Value: undefined } })
      .mockResolvedValueOnce({ EnableDnsSupport: { Value: undefined } });

    const res = await GET(new NextRequest("http://localhost/api/vpc/detail?profile=proj-prod&vpcId=vpc-123"));
    const data = await res.json();
    expect(data.cidr).toBe("");
    expect(data.subnets[0].subnetId).toBe("");
    expect(data.subnets[0].name).toBe("");
    expect(data.securityGroups[0].id).toBe("");
    expect(data.securityGroups[0].inboundCount).toBe(0);
    expect(data.securityGroups[0].outboundCount).toBe(0);
    expect(data.natGateways[0].publicIp).toBe("");
    expect(data.dnsHostnames).toBe(false);
    expect(data.dnsResolution).toBe(false);
  });
});
