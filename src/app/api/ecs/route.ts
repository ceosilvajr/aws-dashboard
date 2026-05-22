import { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import {
  ElasticLoadBalancingV2Client,
  DescribeTargetGroupsCommand,
  DescribeListenersCommand,
  DescribeRulesCommand,
  DescribeLoadBalancersCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { ApplicationAutoScalingClient, DescribeScalableTargetsCommand } from "@aws-sdk/client-application-auto-scaling";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getAccounts, Account } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export interface RuleInfo {
  priority: string;
  conditions: string;
  action: string;
}

export interface ListenerInfo {
  protocol: string;
  port: number;
  rules: RuleInfo[];
}

export interface TargetGroupInfo {
  name: string;
  arn: string;
  protocol: string;
  port: number;
  healthCheckPath: string;
  albName: string;
  listeners: ListenerInfo[];
}

export interface ServiceInfo {
  account: string;
  accountId: string;
  cluster: string;
  service: string;
  container: string;
  image: string;
  tag: string;
  cpu: string;
  memory: string;
  port: number;
  desired: number;
  running: number;
  minCapacity: number;
  maxCapacity: number;
  status: string;
  targetGroups: TargetGroupInfo[];
}

function formatConditions(conditions: { Field?: string; Values?: string[]; HostHeaderConfig?: { Values?: string[] }; PathPatternConfig?: { Values?: string[] } }[]): string {
  return conditions.map((c) => {
    if (c.Field === "host-header") return `Host: ${(c.HostHeaderConfig?.Values ?? c.Values ?? []).join(", ")}`;
    if (c.Field === "path-pattern") return `Path: ${(c.PathPatternConfig?.Values ?? c.Values ?? []).join(", ")}`;
    return `${c.Field}: ${(c.Values ?? []).join(", ")}`;
  }).join(" & ") || "default";
}

function formatActions(actions: { Type?: string; TargetGroupArn?: string; RedirectConfig?: { Protocol?: string; Port?: string; StatusCode?: string } }[]): string {
  return actions.map((a) => {
    if (a.Type === "redirect") return `redirect → ${a.RedirectConfig?.Protocol}:${a.RedirectConfig?.Port}`;
    if (a.Type === "forward") return "forward";
    return a.Type ?? "";
  }).join(", ");
}

async function fetchAccountData(account: Account, region: string): Promise<ServiceInfo[]> {
  const credentials = fromIni({ profile: account.profile });
  const ecs = new ECSClient({ region, credentials });
  const elbv2 = new ElasticLoadBalancingV2Client({ region, credentials });
  const aas = new ApplicationAutoScalingClient({ region, credentials });

  try {
    const { clusterArns } = await ecs.send(new ListClustersCommand({}));
    if (!clusterArns?.length) return [];

    const results: ServiceInfo[] = [];

    for (const clusterArn of clusterArns) {
      const cluster = clusterArn.split("/").pop()!;
      const { serviceArns } = await ecs.send(new ListServicesCommand({ cluster }));
      if (!serviceArns?.length) continue;

      const { services } = await ecs.send(
        new DescribeServicesCommand({ cluster, services: serviceArns })
      );
      if (!services) continue;

      // Fetch scaling targets for this cluster
      const scalingMap = new Map<string, { min: number; max: number }>();
      try {
        const scalingRes = await aas.send(new DescribeScalableTargetsCommand({
          ServiceNamespace: "ecs",
          ResourceIds: services.map((s) => `service/${cluster}/${s.serviceName}`),
        }));
        for (const t of scalingRes.ScalableTargets ?? []) {
          const svcName = t.ResourceId?.split("/").pop() ?? "";
          scalingMap.set(svcName, { min: t.MinCapacity ?? 0, max: t.MaxCapacity ?? 0 });
        }
      } catch { /* no scaling configured */ }

      for (const svc of services) {
        if (!svc.taskDefinition) continue;
        try {
          const { taskDefinition: td } = await ecs.send(
            new DescribeTaskDefinitionCommand({ taskDefinition: svc.taskDefinition })
          );
          const container = td?.containerDefinitions?.[0];
          const fullImage = container?.image || "";
          const [imageRepo, tag] = fullImage.includes(":")
            ? [fullImage.split(":").slice(0, -1).join(":"), fullImage.split(":").pop()!]
            : [fullImage, "latest"];

          // Fetch target group info from ECS service load balancers
          const targetGroups: TargetGroupInfo[] = [];
          const tgArns = (svc.loadBalancers ?? [])
            .map((lb) => lb.targetGroupArn)
            .filter((arn): arn is string => !!arn);

          if (tgArns.length > 0) {
            try {
              const { TargetGroups: tgs } = await elbv2.send(
                new DescribeTargetGroupsCommand({ TargetGroupArns: tgArns })
              );

              for (const tg of tgs ?? []) {
                // Get ALB name from the load balancer ARN
                let albName = "";
                const lbArns = tg.LoadBalancerArns ?? [];
                if (lbArns.length > 0) {
                  try {
                    const { LoadBalancers: lbs } = await elbv2.send(
                      new DescribeLoadBalancersCommand({ LoadBalancerArns: lbArns })
                    );
                    albName = lbs?.[0]?.LoadBalancerName ?? "";
                  } catch { /* skip */ }
                }

                // Get listeners for this ALB and find rules referencing this target group
                const listeners: ListenerInfo[] = [];
                for (const lbArn of lbArns) {
                  try {
                    const { Listeners: lsnrs } = await elbv2.send(
                      new DescribeListenersCommand({ LoadBalancerArn: lbArn })
                    );
                    for (const lsnr of lsnrs ?? []) {
                      const { Rules: rules } = await elbv2.send(
                        new DescribeRulesCommand({ ListenerArn: lsnr.ListenerArn })
                      );
                      const matchingRules: RuleInfo[] = (rules ?? [])
                        .filter((r) =>
                          r.Actions?.some((a) => a.TargetGroupArn === tg.TargetGroupArn)
                        )
                        .map((r) => ({
                          priority: r.Priority ?? "",
                          conditions: formatConditions(r.Conditions ?? []),
                          action: formatActions(r.Actions ?? []),
                        }));

                      if (matchingRules.length > 0) {
                        listeners.push({
                          protocol: lsnr.Protocol ?? "",
                          port: lsnr.Port ?? 0,
                          rules: matchingRules,
                        });
                      }
                    }
                  } catch { /* skip listener errors */ }
                }

                targetGroups.push({
                  name: tg.TargetGroupName ?? "",
                  arn: tg.TargetGroupArn ?? "",
                  protocol: tg.Protocol ?? "",
                  port: tg.Port ?? 0,
                  healthCheckPath: tg.HealthCheckPath ?? "",
                  albName,
                  listeners,
                });
              }
            } catch { /* skip TG errors */ }
          }

          const scaling = scalingMap.get(svc.serviceName || "");
          results.push({
            account: account.name,
            accountId: account.id ?? "",
            cluster,
            service: svc.serviceName || "",
            container: container?.name || "",
            image: imageRepo.split("/").slice(1).join("/") || imageRepo,
            tag,
            cpu: td?.cpu || "0",
            memory: td?.memory || "0",
            port: container?.portMappings?.[0]?.containerPort || 0,
            desired: svc.desiredCount || 0,
            running: svc.runningCount || 0,
            minCapacity: scaling?.min ?? svc.desiredCount ?? 0,
            maxCapacity: scaling?.max ?? svc.desiredCount ?? 0,
            status: svc.runningCount === svc.desiredCount ? "healthy" : "unhealthy",
            targetGroups,
          });
        } catch { /* skip failed task definitions */ }
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = getRegion(request);
  const accounts = await getAccounts();
  const targets = profile ? accounts.filter((a) => a.profile === profile) : accounts;
  const allResults = await Promise.all(targets.map((a) => fetchAccountData(a, region)));
  const services = allResults.flat();
  return NextResponse.json({ services, fetchedAt: new Date().toISOString() });
}
