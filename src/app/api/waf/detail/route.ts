import { NextRequest, NextResponse } from "next/server";
import { WAFV2Client, GetWebACLCommand, ListResourcesForWebACLCommand } from "@aws-sdk/client-wafv2";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";
import { getMissingRecommendations } from "@/lib/waf-recommendations";

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
    const rules = (acl.Rules ?? []).map((r) => {
      const managed = r.Statement?.ManagedRuleGroupStatement;
      const action = r.Action ? Object.keys(r.Action)[0] ?? "none" : r.OverrideAction ? "override" : "none";
      const category: "managed" | "custom" = managed ? "managed" : "custom";
      const overridden = Boolean(r.OverrideAction && "Count" in r.OverrideAction);
      const status: "enabled" | "disabled" | "overridden" = overridden
        ? "overridden"
        : action === "none"
        ? "disabled"
        : "enabled";
      const type = managed
        ? `Managed: ${managed.VendorName}/${managed.Name}`
        : r.Statement?.RateBasedStatement
        ? "RateBased"
        : r.Statement?.RuleGroupReferenceStatement
        ? "RuleGroup"
        : "Custom";
      return {
        name: r.Name ?? "",
        priority: r.Priority ?? 0,
        action,
        type,
        category,
        status,
        ...(managed?.Name ? { managedRuleName: managed.Name } : {}),
      };
    });

    const managedRules = rules.filter((r) => r.category === "managed");
    const customRules = rules.filter((r) => r.category === "custom");
    const enabledManagedNames = managedRules
      .map((r) => r.managedRuleName)
      .filter((n): n is string => Boolean(n));
    const recommendations = getMissingRecommendations(enabledManagedNames);

    return NextResponse.json({
      name: acl.Name,
      arn: acl.ARN,
      capacity: acl.Capacity ?? 0,
      defaultAction: acl.DefaultAction ? Object.keys(acl.DefaultAction)[0] : "unknown",
      rules,
      managedRules,
      customRules,
      recommendations,
      associatedResources: (resRes as { ResourceArns?: string[] }).ResourceArns ?? [],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
