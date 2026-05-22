import { NextRequest, NextResponse } from "next/server";
import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeRouteTablesCommand, DescribeSecurityGroupsCommand, DescribeNatGatewaysCommand, DescribeVpcAttributeCommand } from "@aws-sdk/client-ec2";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const vpcId = request.nextUrl.searchParams.get("vpcId");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile) || !vpcId) {
    return NextResponse.json({ error: "profile and vpcId required" }, { status: 400 });
  }

  try {
    const ec2 = createClient(EC2Client, profile, getRegion(request));
    const vpcFilter = [{ Name: "vpc-id" as const, Values: [vpcId] }];

    const [vpcRes, subRes, rtRes, sgRes, natRes, dnsHostnames, dnsResolution] = await Promise.all([
      ec2.send(new DescribeVpcsCommand({ VpcIds: [vpcId] })),
      ec2.send(new DescribeSubnetsCommand({ Filters: vpcFilter })),
      ec2.send(new DescribeRouteTablesCommand({ Filters: vpcFilter })),
      ec2.send(new DescribeSecurityGroupsCommand({ Filters: vpcFilter })),
      ec2.send(new DescribeNatGatewaysCommand({ Filter: vpcFilter })),
      ec2.send(new DescribeVpcAttributeCommand({ VpcId: vpcId, Attribute: "enableDnsHostnames" })),
      ec2.send(new DescribeVpcAttributeCommand({ VpcId: vpcId, Attribute: "enableDnsSupport" })),
    ]);

    const vpc = vpcRes.Vpcs?.[0];
    return NextResponse.json({
      vpcId,
      name: vpc?.Tags?.find((t) => t.Key === "Name")?.Value ?? "",
      cidr: vpc?.CidrBlock ?? "",
      state: vpc?.State ?? "",
      isDefault: vpc?.IsDefault ?? false,
      dnsHostnames: dnsHostnames.EnableDnsHostnames?.Value ?? false,
      dnsResolution: dnsResolution.EnableDnsSupport?.Value ?? false,
      subnets: (subRes.Subnets ?? []).map((s) => ({
        subnetId: s.SubnetId ?? "",
        cidr: s.CidrBlock ?? "",
        az: s.AvailabilityZone ?? "",
        availableIps: s.AvailableIpAddressCount ?? 0,
        mapPublicIp: s.MapPublicIpOnLaunch ?? false,
        name: s.Tags?.find((t) => t.Key === "Name")?.Value ?? "",
      })),
      routeTables: (rtRes.RouteTables ?? []).map((rt) => ({
        id: rt.RouteTableId ?? "",
        name: rt.Tags?.find((t) => t.Key === "Name")?.Value ?? "",
        associations: (rt.Associations ?? []).map((a) => ({ subnetId: a.SubnetId ?? "main" })),
        routes: (rt.Routes ?? []).map((r) => ({
          destination: r.DestinationCidrBlock ?? r.DestinationIpv6CidrBlock ?? r.DestinationPrefixListId ?? "",
          target: r.GatewayId ?? r.NatGatewayId ?? r.NetworkInterfaceId ?? r.TransitGatewayId ?? r.VpcPeeringConnectionId ?? "",
          state: r.State ?? "",
        })),
      })),
      securityGroups: (sgRes.SecurityGroups ?? []).map((sg) => ({
        id: sg.GroupId ?? "",
        name: sg.GroupName ?? "",
        description: sg.Description ?? "",
        inboundCount: sg.IpPermissions?.length ?? 0,
        outboundCount: sg.IpPermissionsEgress?.length ?? 0,
      })),
      natGateways: (natRes.NatGateways ?? []).filter((n) => n.State !== "deleted").map((n) => ({
        id: n.NatGatewayId ?? "",
        state: n.State ?? "",
        subnetId: n.SubnetId ?? "",
        publicIp: n.NatGatewayAddresses?.[0]?.PublicIp ?? "",
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
