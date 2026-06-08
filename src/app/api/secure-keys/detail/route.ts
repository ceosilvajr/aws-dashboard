import { SecretsManagerClient, DescribeSecretCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand, DescribeParametersCommand } from "@aws-sdk/client-ssm";
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/aws-clients";
import { getRegion } from "@/lib/constants";

function iso(d?: Date): string | null {
  return d ? d.toISOString() : null;
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");
  const profile = request.nextUrl.searchParams.get("profile");
  const id = request.nextUrl.searchParams.get("id");
  const name = request.nextUrl.searchParams.get("name");

  if (!profile) {
    return NextResponse.json({ error: "profile is required" }, { status: 400 });
  }
  if (kind !== "secret" && kind !== "parameter") {
    return NextResponse.json({ error: "kind must be 'secret' or 'parameter'" }, { status: 400 });
  }

  const region = getRegion(request);

  try {
    if (kind === "secret") {
      const secretId = id ?? name;
      if (!secretId) {
        return NextResponse.json({ error: "id is required for secret" }, { status: 400 });
      }
      const client = createClient(SecretsManagerClient, profile, region);
      const s = await client.send(new DescribeSecretCommand({ SecretId: secretId }));
      return NextResponse.json({
        kind: "secret",
        name: s.Name ?? "",
        arn: s.ARN ?? "",
        description: s.Description ?? "",
        rotationEnabled: s.RotationEnabled ?? false,
        lastChangedDate: iso(s.LastChangedDate),
        lastAccessedDate: iso(s.LastAccessedDate),
        createdDate: iso(s.CreatedDate),
        tags: (s.Tags ?? []).map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" })),
      });
    }

    if (!name) {
      return NextResponse.json({ error: "name is required for parameter" }, { status: 400 });
    }
    const client = createClient(SSMClient, profile, region);
    // WithDecryption: false — never decrypt SecureString values (read-only metadata only).
    const got = await client.send(new GetParameterCommand({ Name: name, WithDecryption: false }));
    const meta = await client.send(new DescribeParametersCommand({
      ParameterFilters: [{ Key: "Name", Option: "Equals", Values: [name] }],
    }));
    const m = meta.Parameters?.[0];
    const p = got.Parameter;
    return NextResponse.json({
      kind: "parameter",
      name: p?.Name ?? name,
      type: p?.Type ?? "",
      version: p?.Version ?? 0,
      lastModifiedDate: iso(p?.LastModifiedDate),
      description: m?.Description ?? "",
      tier: m?.Tier ?? "",
      dataType: p?.DataType ?? "",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
