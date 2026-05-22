import { NextRequest, NextResponse } from "next/server";
import { Route53Client, ListHostedZonesCommand } from "@aws-sdk/client-route-53";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const r53 = createClient(Route53Client, profile, "us-east-1");
    const res = await r53.send(new ListHostedZonesCommand({}));
    const zones = (res.HostedZones ?? []).map((z) => ({
      id: z.Id?.replace("/hostedzone/", "") ?? "",
      name: z.Name ?? "",
      type: z.Config?.PrivateZone ? "Private" : "Public",
      recordCount: z.ResourceRecordSetCount ?? 0,
    }));
    return NextResponse.json({ zones });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
