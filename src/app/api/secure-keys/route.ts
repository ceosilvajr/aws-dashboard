import { SecretsManagerClient, ListSecretsCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, DescribeParametersCommand } from "@aws-sdk/client-ssm";
import { NextResponse, NextRequest } from "next/server";
import { getAccounts, Account } from "@/lib/accounts";
import { createClient } from "@/lib/aws-clients";
import { getRegion } from "@/lib/constants";

export interface SecretInfo {
  name: string;
  arn: string;
  description: string;
  lastChangedDate: string | null;
  lastAccessedDate: string | null;
}

export interface ParameterInfo {
  name: string;
  type: string;
  lastModifiedDate: string | null;
  version: number;
}

async function fetchSecrets(account: Account, region: string): Promise<SecretInfo[]> {
  const client = createClient(SecretsManagerClient, account.profile, region);
  try {
    const out: SecretInfo[] = [];
    let nextToken: string | undefined;
    do {
      const { SecretList, NextToken } = await client.send(new ListSecretsCommand({ MaxResults: 100, NextToken: nextToken }));
      nextToken = NextToken;
      for (const s of SecretList ?? []) {
        out.push({
          name: s.Name ?? "",
          arn: s.ARN ?? "",
          description: s.Description ?? "",
          lastChangedDate: s.LastChangedDate ? s.LastChangedDate.toISOString() : null,
          lastAccessedDate: s.LastAccessedDate ? s.LastAccessedDate.toISOString() : null,
        });
      }
    } while (nextToken);
    return out;
  } catch {
    return [];
  }
}

async function fetchParameters(account: Account, region: string): Promise<ParameterInfo[]> {
  const client = createClient(SSMClient, account.profile, region);
  try {
    const out: ParameterInfo[] = [];
    let nextToken: string | undefined;
    do {
      const { Parameters, NextToken } = await client.send(new DescribeParametersCommand({ MaxResults: 50, NextToken: nextToken }));
      nextToken = NextToken;
      for (const p of Parameters ?? []) {
        out.push({
          name: p.Name ?? "",
          type: p.Type ?? "",
          lastModifiedDate: p.LastModifiedDate ? p.LastModifiedDate.toISOString() : null,
          version: p.Version ?? 0,
        });
      }
    } while (nextToken);
    return out;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = getRegion(request);
  const accounts = await getAccounts();
  const targets = profile ? accounts.filter((a) => a.profile === profile) : accounts;

  const secretsNested = await Promise.all(targets.map((a) => fetchSecrets(a, region)));
  const parametersNested = await Promise.all(targets.map((a) => fetchParameters(a, region)));

  return NextResponse.json({
    secrets: secretsNested.flat(),
    parameters: parametersNested.flat(),
    fetchedAt: new Date().toISOString(),
  });
}
