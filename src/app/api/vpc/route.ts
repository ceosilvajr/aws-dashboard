import { NextRequest, NextResponse } from "next/server";
import { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand } from "@aws-sdk/client-ec2";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const ec2 = createClient(EC2Client, profile, getRegion(request));
    const vpcRes = await ec2.send(new DescribeVpcsCommand({}));
    const vpcs = await Promise.all(
      (vpcRes.Vpcs ?? []).map(async (vpc) => {
        const subRes = await ec2.send(new DescribeSubnetsCommand({ Filters: [{ Name: "vpc-id", Values: [vpc.VpcId!] }] }));
        return {
          vpcId: vpc.VpcId ?? "",
          name: vpc.Tags?.find((t) => t.Key === "Name")?.Value ?? "",
          cidr: vpc.CidrBlock ?? "",
          state: vpc.State ?? "",
          isDefault: vpc.IsDefault ?? false,
          subnetCount: subRes.Subnets?.length ?? 0,
        };
      })
    );
    return NextResponse.json({ vpcs });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
