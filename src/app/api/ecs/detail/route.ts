import { NextRequest, NextResponse } from "next/server";
import { ECSClient, DescribeServicesCommand, DescribeTaskDefinitionCommand, ListTasksCommand } from "@aws-sdk/client-ecs";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const cluster = request.nextUrl.searchParams.get("cluster");
  const service = request.nextUrl.searchParams.get("service");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile) || !cluster || !service) {
    return NextResponse.json({ error: "profile, cluster, and service required" }, { status: 400 });
  }

  try {
    const ecs = createClient(ECSClient, profile, getRegion(request));

    const svcRes = await ecs.send(new DescribeServicesCommand({ cluster, services: [service] }));
    const svc = svcRes.services?.[0];
    if (!svc) return NextResponse.json({ error: "service not found" }, { status: 404 });

    const tdRes = await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: svc.taskDefinition! }));
    const td = tdRes.taskDefinition!;
    const container = td.containerDefinitions?.[0];

    const tasksRes = await ecs.send(new ListTasksCommand({ cluster, serviceName: service, desiredStatus: "RUNNING" }));

    return NextResponse.json({
      service: svc.serviceName,
      cluster,
      cpu: td.cpu ?? "0",
      memory: td.memory ?? "0",
      desiredCount: svc.desiredCount ?? 0,
      runningCount: tasksRes.taskArns?.length ?? 0,
      envVars: (container?.environment ?? []).map((e) => ({ name: e.name ?? "", value: e.value ?? "" })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
