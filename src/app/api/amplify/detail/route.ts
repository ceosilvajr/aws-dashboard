import { NextRequest, NextResponse } from "next/server";
import { AmplifyClient, GetAppCommand, ListDomainAssociationsCommand, ListBranchesCommand } from "@aws-sdk/client-amplify";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const appId = request.nextUrl.searchParams.get("appId");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }
  if (!appId) {
    return NextResponse.json({ error: "appId required" }, { status: 400 });
  }

  try {
    const client = createClient(AmplifyClient, profile, getRegion(request));

    const [appRes, domainsRes, branchesRes] = await Promise.all([
      client.send(new GetAppCommand({ appId })),
      client.send(new ListDomainAssociationsCommand({ appId })),
      client.send(new ListBranchesCommand({ appId })),
    ]);

    const app = appRes.app!;
    const domains = (domainsRes.domainAssociations ?? []).map((d) => ({
      domainName: d.domainName ?? "",
      status: d.domainStatus ?? "",
      subDomains: (d.subDomains ?? []).map((s) => ({
        prefix: s.subDomainSetting?.prefix ?? "",
        branchName: s.subDomainSetting?.branchName ?? "",
        verified: s.verified ?? false,
        dnsRecord: s.dnsRecord ?? "",
      })),
    }));

    const branches = (branchesRes.branches ?? []).map((b) => ({
      branchName: b.branchName ?? "",
      stage: b.stage ?? "",
      status: b.activeJobId ? "DEPLOYING" : "STABLE",
      lastDeployTime: b.updateTime?.toISOString() ?? "",
      displayName: b.displayName ?? b.branchName ?? "",
    }));

    const envVars = Object.entries(app.environmentVariables ?? {}).map(([key, value]) => ({ key, value }));

    return NextResponse.json({
      appId: app.appId,
      name: app.name,
      platform: app.platform,
      repository: app.repository ?? "",
      defaultDomain: app.defaultDomain ?? "",
      createTime: app.createTime?.toISOString() ?? "",
      updateTime: app.updateTime?.toISOString() ?? "",
      domains,
      branches,
      envVars,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
