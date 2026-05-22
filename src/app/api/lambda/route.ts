import { NextRequest, NextResponse } from "next/server";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const lambda = createClient(LambdaClient, profile, getRegion(request));
    const functions: { name: string; runtime: string; memory: number; timeout: number; lastModified: string; state: string }[] = [];
    let marker: string | undefined;

    do {
      const res = await lambda.send(new ListFunctionsCommand({ Marker: marker }));
      for (const fn of res.Functions ?? []) {
        functions.push({
          name: fn.FunctionName ?? "",
          runtime: fn.Runtime ?? "",
          memory: fn.MemorySize ?? 0,
          timeout: fn.Timeout ?? 0,
          lastModified: fn.LastModified ?? "",
          state: fn.State ?? "Active",
        });
      }
      marker = res.NextMarker;
    } while (marker);

    return NextResponse.json({ functions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
