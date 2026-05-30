import {
  SNSClient,
  ListPlatformApplicationsCommand,
  GetPlatformApplicationAttributesCommand,
} from "@aws-sdk/client-sns";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getAccounts, Account } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export interface PlatformAppInfo {
  account: string;
  accountId: string;
  profile: string;
  arn: string;
  name: string;
  platform: string;
  enabled: boolean;
  attributes: Record<string, string>;
}

function parsePlatformFromArn(arn: string): string {
  // ARN format: arn:aws:sns:region:accountId:app/PLATFORM/name
  const parts = arn.split("/");
  return parts.length >= 2 ? parts[1] : "UNKNOWN";
}

function parseNameFromArn(arn: string): string {
  const parts = arn.split("/");
  return parts.length >= 3 ? parts[2] : arn;
}

async function fetchAccountData(account: Account, region: string): Promise<PlatformAppInfo[]> {
  const credentials = fromIni({ profile: account.profile });
  const sns = new SNSClient({ region, credentials });

  try {
    const apps: PlatformAppInfo[] = [];
    let nextToken: string | undefined;

    do {
      const { PlatformApplications, NextToken } = await sns.send(
        new ListPlatformApplicationsCommand({ NextToken: nextToken })
      );
      nextToken = NextToken;

      await Promise.all((PlatformApplications ?? []).map(async (app) => {
        const arn = app.PlatformApplicationArn!;
        const { Attributes } = await sns.send(
          new GetPlatformApplicationAttributesCommand({ PlatformApplicationArn: arn })
        );
        const attrs = Attributes ?? {};
        apps.push({
          account: account.name,
          accountId: account.id ?? "",
          profile: account.profile,
          arn,
          name: parseNameFromArn(arn),
          platform: parsePlatformFromArn(arn),
          enabled: attrs.Enabled === "true",
          attributes: attrs,
        });
      }));
    } while (nextToken);

    return apps;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = getRegion(request);
  const accounts = await getAccounts();
  const targets = profile ? accounts.filter((a) => a.profile === profile) : accounts;
  const results = await Promise.all(targets.map((a) => fetchAccountData(a, region)));
  return NextResponse.json({ platforms: results.flat(), fetchedAt: new Date().toISOString() });
}
