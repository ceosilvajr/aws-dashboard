import { NextRequest, NextResponse } from "next/server";
import { Route53Client, GetHostedZoneCommand, ListResourceRecordSetsCommand } from "@aws-sdk/client-route-53";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const zoneId = request.nextUrl.searchParams.get("zoneId");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile) || !zoneId) {
    return NextResponse.json({ error: "profile and zoneId required" }, { status: 400 });
  }

  try {
    const r53 = createClient(Route53Client, profile, "us-east-1");
    const [zoneRes, recordsRes] = await Promise.all([
      r53.send(new GetHostedZoneCommand({ Id: zoneId })),
      r53.send(new ListResourceRecordSetsCommand({ HostedZoneId: zoneId })),
    ]);

    const zone = zoneRes.HostedZone!;
    const records = (recordsRes.ResourceRecordSets ?? []).map((r) => ({
      name: r.Name ?? "",
      type: r.Type ?? "",
      ttl: r.TTL ?? null,
      values: r.ResourceRecords?.map((rr) => rr.Value ?? "") ?? (r.AliasTarget ? [`ALIAS → ${r.AliasTarget.DNSName}`] : []),
    }));

    return NextResponse.json({
      id: zone.Id?.replace("/hostedzone/", "") ?? "",
      name: zone.Name ?? "",
      type: zone.Config?.PrivateZone ? "Private" : "Public",
      recordCount: zone.ResourceRecordSetCount ?? 0,
      vpcs: (zoneRes.VPCs ?? []).map((v) => ({ vpcId: v.VPCId ?? "", region: v.VPCRegion ?? "" })),
      records,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
