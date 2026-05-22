import { NextRequest, NextResponse } from "next/server";
import { WAFV2Client, GetWebACLCommand, ListResourcesForWebACLCommand } from "@aws-sdk/client-wafv2";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const id = request.nextUrl.searchParams.get("id");
  const name = request.nextUrl.searchParams.get("name");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile) || !id || !name) {
    return NextResponse.json({ error: "profile, id, and name required" }, { status: 400 });
  }

  const region = getRegion(request);
  try {
    const waf = createClient(WAFV2Client, profile, region);
    const [aclRes, resRes] = await Promise.all([
      waf.send(new GetWebACLCommand({ Id: id, Name: name, Scope: "REGIONAL" })),
      waf.send(new ListResourcesForWebACLCommand({ WebACLArn: `arn:aws:wafv2:${region}:*:regional/webacl/${name}/${id}`, ResourceType: "APPLICATION_LOAD_BALANCER" })).catch(() => ({ ResourceArns: [] as string[] })),
    ]);

    const acl = aclRes.WebACL!;
    const rules = (acl.Rules ?? []).map((r) => ({
      name: r.Name ?? "",
      priority: r.Priority ?? 0,
      action: r.Action ? Object.keys(r.Action)[0] ?? "none" : r.OverrideAction ? "override" : "none",
      type: r.Statement?.ManagedRuleGroupStatement ? `Managed: ${r.Statement.ManagedRuleGroupStatement.VendorName}/${r.Statement.ManagedRuleGroupStatement.Name}` : r.Statement?.RateBasedStatement ? "RateBased" : r.Statement?.RuleGroupReferenceStatement ? "RuleGroup" : "Custom",
    }));

    return NextResponse.json({
      name: acl.Name,
      arn: acl.ARN,
      capacity: acl.Capacity ?? 0,
      defaultAction: acl.DefaultAction ? Object.keys(acl.DefaultAction)[0] : "unknown",
      rules,
      associatedResources: (resRes as { ResourceArns?: string[] }).ResourceArns ?? [],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
