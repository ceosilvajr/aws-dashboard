import { NextRequest, NextResponse } from "next/server";
import { ApplicationAutoScalingClient, DescribeScalableTargetsCommand, DescribeScalingPoliciesCommand } from "@aws-sdk/client-application-auto-scaling";
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
    const aas = createClient(ApplicationAutoScalingClient, profile, getRegion(request));
    const resourceId = `service/${cluster}/${service}`;

    const [targetsRes, policiesRes] = await Promise.all([
      aas.send(new DescribeScalableTargetsCommand({ ServiceNamespace: "ecs", ResourceIds: [resourceId] })),
      aas.send(new DescribeScalingPoliciesCommand({ ServiceNamespace: "ecs", ResourceId: resourceId })),
    ]);

    const target = targetsRes.ScalableTargets?.[0];
    const policies = (policiesRes.ScalingPolicies ?? []).map((p) => ({
      name: p.PolicyName ?? "",
      type: p.PolicyType ?? "",
      metric: p.TargetTrackingScalingPolicyConfiguration?.PredefinedMetricSpecification?.PredefinedMetricType
        ?? p.TargetTrackingScalingPolicyConfiguration?.CustomizedMetricSpecification?.MetricName
        ?? "",
      targetValue: p.TargetTrackingScalingPolicyConfiguration?.TargetValue ?? null,
      scaleInCooldown: p.TargetTrackingScalingPolicyConfiguration?.ScaleInCooldown ?? null,
      scaleOutCooldown: p.TargetTrackingScalingPolicyConfiguration?.ScaleOutCooldown ?? null,
      stepAdjustments: p.StepScalingPolicyConfiguration?.StepAdjustments?.map((s) => ({
        lower: s.MetricIntervalLowerBound ?? null,
        upper: s.MetricIntervalUpperBound ?? null,
        adjustment: s.ScalingAdjustment ?? 0,
      })) ?? [],
    }));

    return NextResponse.json({
      resourceId,
      minCapacity: target?.MinCapacity ?? null,
      maxCapacity: target?.MaxCapacity ?? null,
      suspendedState: target?.SuspendedState ?? null,
      policies,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
