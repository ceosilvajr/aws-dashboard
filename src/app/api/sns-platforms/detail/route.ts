import {
  SNSClient,
  GetPlatformApplicationAttributesCommand,
  ListEndpointsByPlatformApplicationCommand,
} from "@aws-sdk/client-sns";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getRegion } from "@/lib/constants";

export interface PlatformEndpoint {
  arn: string;
  token: string;
  enabled: boolean;
  userData?: string;
}

export interface PlatformDetailResponse {
  attributes: Record<string, string>;
  endpoints: PlatformEndpoint[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const arn = searchParams.get("arn");
  const profile = searchParams.get("profile");
  const region = getRegion(request);

  if (!arn || !profile) {
    return NextResponse.json({ error: "arn and profile are required" }, { status: 400 });
  }

  try {
    const credentials = fromIni({ profile });
    const sns = new SNSClient({ region, credentials });

    const [{ Attributes }, endpoints] = await Promise.all([
      sns.send(new GetPlatformApplicationAttributesCommand({ PlatformApplicationArn: arn })),
      (async () => {
        const all: PlatformEndpoint[] = [];
        let nextToken: string | undefined;
        do {
          const { Endpoints, NextToken } = await sns.send(
            new ListEndpointsByPlatformApplicationCommand({
              PlatformApplicationArn: arn,
              NextToken: nextToken,
            })
          );
          nextToken = NextToken;
          for (const ep of Endpoints ?? []) {
            const epArn = ep.EndpointArn ?? "";
            const attrs = ep.Attributes ?? {};
            const token = attrs.Token ?? "";
            all.push({
              arn: epArn,
              token: token.length > 20 ? `${token.slice(0, 10)}…${token.slice(-10)}` : token,
              enabled: attrs.Enabled === "true",
              userData: attrs.CustomUserData,
            });
          }
        } while (nextToken);
        return all;
      })(),
    ]);

    return NextResponse.json({ attributes: Attributes ?? {}, endpoints });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
