import { CognitoIdentityProviderClient, ListUserPoolsCommand, DescribeUserPoolCommand } from "@aws-sdk/client-cognito-identity-provider";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getAccounts, Account } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export interface UserPoolInfo {
  account: string;
  accountId: string;
  profile: string;
  poolId: string;
  poolName: string;
  estimatedUsers: number;
}

async function fetchAccountData(account: Account, region: string): Promise<UserPoolInfo[]> {
  const credentials = fromIni({ profile: account.profile });
  const cognito = new CognitoIdentityProviderClient({ region, credentials });

  try {
    const pools: UserPoolInfo[] = [];
    let nextToken: string | undefined;

    do {
      const { UserPools, NextToken } = await cognito.send(
        new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken })
      );
      nextToken = NextToken;

      await Promise.all((UserPools ?? []).map(async (pool) => {
        const { UserPool } = await cognito.send(new DescribeUserPoolCommand({ UserPoolId: pool.Id! }));
        pools.push({
          account: account.name,
          accountId: account.id ?? "",
          profile: account.profile,
          poolId: pool.Id!,
          poolName: pool.Name!,
          estimatedUsers: UserPool?.EstimatedNumberOfUsers ?? 0,
        });
      }));
    } while (nextToken);

    return pools;
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
  return NextResponse.json({ pools: results.flat(), fetchedAt: new Date().toISOString() });
}
