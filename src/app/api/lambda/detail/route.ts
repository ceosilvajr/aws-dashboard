import { NextRequest, NextResponse } from "next/server";
import {
  LambdaClient,
  GetFunctionCommand,
  GetFunctionConcurrencyCommand,
  ListEventSourceMappingsCommand,
} from "@aws-sdk/client-lambda";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const name = request.nextUrl.searchParams.get("name");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  try {
    const lambda = createClient(LambdaClient, profile, getRegion(request));

    const [fnRes, concurrencyRes, eventSourcesRes] = await Promise.all([
      lambda.send(new GetFunctionCommand({ FunctionName: name })),
      lambda.send(new GetFunctionConcurrencyCommand({ FunctionName: name })),
      lambda.send(new ListEventSourceMappingsCommand({ FunctionName: name })),
    ]);

    const config = fnRes.Configuration;
    const detail = {
      name: config?.FunctionName ?? "",
      arn: config?.FunctionArn ?? "",
      runtime: config?.Runtime ?? "",
      handler: config?.Handler ?? "",
      role: config?.Role ?? "",
      codeSize: config?.CodeSize ?? 0,
      description: config?.Description ?? "",
      lastModified: config?.LastModified ?? "",
      state: config?.State ?? "Active",
      stateReason: config?.StateReason ?? "",
      // Health
      lastUpdateStatus: config?.LastUpdateStatus ?? "",
      lastUpdateReason: config?.LastUpdateStatusReason ?? "",
      // Scalability
      memorySize: config?.MemorySize ?? 0,
      timeout: config?.Timeout ?? 0,
      ephemeralStorage: config?.EphemeralStorage?.Size ?? 512,
      reservedConcurrency: concurrencyRes.ReservedConcurrentExecutions ?? null,
      // Networking
      vpcId: config?.VpcConfig?.VpcId ?? "",
      subnetIds: config?.VpcConfig?.SubnetIds ?? [],
      securityGroupIds: config?.VpcConfig?.SecurityGroupIds ?? [],
      // Environment
      envVarCount: Object.keys(config?.Environment?.Variables ?? {}).length,
      // Layers
      layers: (config?.Layers ?? []).map((l) => l.Arn ?? ""),
      // Architecture
      architectures: config?.Architectures ?? [],
      // Event sources
      eventSources: (eventSourcesRes.EventSourceMappings ?? []).map((e) => ({
        source: e.EventSourceArn ?? "",
        state: e.State ?? "",
        batchSize: e.BatchSize ?? 0,
      })),
    };

    return NextResponse.json(detail);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
