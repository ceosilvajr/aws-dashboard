import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { fromIni } from "@aws-sdk/credential-providers";
import { REGION } from "./constants";

export interface DynamicAccount {
  id: string | null;
  name: string;
  profile: string;
  group: string;
}

let cached: DynamicAccount[] | null = null;

function extractAccountId(profile: Record<string, string | undefined>): string | null {
  if (profile.role_arn) {
    const match = profile.role_arn.match(/arn:aws:iam::(\d+):/);
    if (match) return match[1];
  }
  if (profile.sso_account_id) return profile.sso_account_id;
  return null;
}

function deriveGroup(profileName: string): string {
  const idx = profileName.indexOf("-");
  return idx > 0 ? profileName.substring(0, idx) : profileName;
}

async function resolveAccountId(profileName: string): Promise<string | null> {
  try {
    const sts = new STSClient({ region: REGION, credentials: fromIni({ profile: profileName }) });
    const res = await sts.send(new GetCallerIdentityCommand({}));
    return res.Account ?? null;
  } catch {
    return null;
  }
}

export async function parseAwsConfig(): Promise<DynamicAccount[]> {
  if (cached) return cached;

  const { configFile } = await loadSharedConfigFiles();
  const profiles = Object.keys(configFile).filter((name) => name !== "default");

  const accounts: DynamicAccount[] = [];

  for (const name of profiles) {
    // Skip sso-session entries (they appear as profiles but aren't real accounts)
    if (configFile[name].sso_start_url && !configFile[name].sso_account_id) continue;

    let id = extractAccountId(configFile[name]);

    if (!id) {
      id = await resolveAccountId(name);
    }

    accounts.push({
      id,
      name,
      profile: name,
      group: deriveGroup(name),
    });
  }

  cached = accounts;
  return accounts;
}

export function getGroups(accounts: DynamicAccount[]): string[] {
  return [...new Set(accounts.map((a) => a.group))];
}

export function invalidateCache() {
  cached = null;
}
