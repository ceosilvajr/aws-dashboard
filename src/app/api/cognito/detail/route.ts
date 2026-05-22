import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const poolId = request.nextUrl.searchParams.get("poolId");
  const profile = request.nextUrl.searchParams.get("profile");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!poolId || !profile) {
    return NextResponse.json({ error: "poolId and profile are required" }, { status: 400 });
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const credentials = fromIni({ profile });
  const cognito = new CognitoIdentityProviderClient({ region: getRegion(request), credentials });

  const status: Record<string, number> = {
    CONFIRMED: 0, UNCONFIRMED: 0, ARCHIVED: 0,
    COMPROMISED: 0, UNKNOWN: 0, RESET_REQUIRED: 0, FORCE_CHANGE_PASSWORD: 0,
    total: 0,
  };

  try {
    let paginationToken: string | undefined;
    do {
      const { Users, PaginationToken } = await cognito.send(
        new ListUsersCommand({ UserPoolId: poolId, Limit: 60, PaginationToken: paginationToken })
      );
      paginationToken = PaginationToken;

      for (const user of Users ?? []) {
        const created = user.UserCreateDate;
        if (fromDate && created && created < fromDate) continue;
        if (toDate && created && created > toDate) continue;

        const s = user.UserStatus ?? "UNKNOWN";
        if (s in status) status[s]++;
        else status.UNKNOWN++;
        status.total++;
      }
    } while (paginationToken);

    return NextResponse.json(status);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
