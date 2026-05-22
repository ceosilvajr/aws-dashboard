import { NextRequest, NextResponse } from "next/server";
import { AmplifyClient, ListAppsCommand } from "@aws-sdk/client-amplify";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const client = createClient(AmplifyClient, profile, getRegion(request));
    const apps: { appId: string; name: string; platform: string; repository: string; defaultDomain: string; updateTime: string }[] = [];
    let token: string | undefined;

    do {
      const res = await client.send(new ListAppsCommand({ nextToken: token }));
      for (const app of res.apps ?? []) {
        if (app.platform !== "WEB" && app.platform !== "WEB_DYNAMIC" && app.platform !== "WEB_COMPUTE") continue;
        apps.push({
          appId: app.appId ?? "",
          name: app.name ?? "",
          platform: app.platform ?? "",
          repository: app.repository ?? "",
          defaultDomain: app.defaultDomain ?? "",
          updateTime: app.updateTime?.toISOString() ?? "",
        });
      }
      token = res.nextToken;
    } while (token);

    return NextResponse.json({ apps });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
