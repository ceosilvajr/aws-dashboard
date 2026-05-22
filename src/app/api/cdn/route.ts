import { NextRequest, NextResponse } from "next/server";
import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const cf = createClient(CloudFrontClient, profile, "us-east-1");
    const res = await cf.send(new ListDistributionsCommand({}));
    const distributions = (res.DistributionList?.Items ?? []).map((d) => ({
      id: d.Id ?? "",
      domain: d.DomainName ?? "",
      aliases: d.Aliases?.Items ?? [],
      status: d.Status ?? "",
      enabled: d.Enabled ?? false,
      origins: (d.Origins?.Items ?? []).map((o) => o.DomainName ?? ""),
    }));
    return NextResponse.json({ distributions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
