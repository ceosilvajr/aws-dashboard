import { NextRequest, NextResponse } from "next/server";
import { WAFV2Client, ListWebACLsCommand } from "@aws-sdk/client-wafv2";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const waf = createClient(WAFV2Client, profile, getRegion(request));
    const res = await waf.send(new ListWebACLsCommand({ Scope: "REGIONAL", Limit: 100 }));
    const acls = (res.WebACLs ?? []).map((acl) => ({
      id: acl.Id ?? "",
      name: acl.Name ?? "",
      arn: acl.ARN ?? "",
    }));
    return NextResponse.json({ acls });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
