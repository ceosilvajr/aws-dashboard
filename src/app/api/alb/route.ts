import { NextRequest, NextResponse } from "next/server";
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeListenersCommand,
  DescribeRulesCommand,
} from "@aws-sdk/client-elastic-load-balancing-v2";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const elb = createClient(ElasticLoadBalancingV2Client, profile, getRegion(request));
    const lbRes = await elb.send(new DescribeLoadBalancersCommand({}));
    const loadBalancers = lbRes.LoadBalancers ?? [];

    const results = await Promise.all(
      loadBalancers.map(async (lb) => {
        const listenersRes = await elb.send(
          new DescribeListenersCommand({ LoadBalancerArn: lb.LoadBalancerArn })
        );
        const listeners = await Promise.all(
          (listenersRes.Listeners ?? []).map(async (listener) => {
            const rulesRes = await elb.send(
              new DescribeRulesCommand({ ListenerArn: listener.ListenerArn })
            );
            const rules = (rulesRes.Rules ?? []).map((rule) => ({
              priority: rule.Priority ?? "",
              isDefault: rule.IsDefault ?? false,
              conditions: rule.Conditions?.map((c) => ({
                field: c.Field ?? "",
                values: c.Values ?? [],
                hostHeader: c.HostHeaderConfig?.Values ?? [],
                pathPattern: c.PathPatternConfig?.Values ?? [],
              })) ?? [],
              actions: rule.Actions?.map((a) => ({
                type: a.Type ?? "",
                targetGroupArn: a.TargetGroupArn ?? "",
                forwardConfig: a.ForwardConfig?.TargetGroups?.map((tg) => tg.TargetGroupArn ?? "") ?? [],
              })) ?? [],
            }));
            return {
              port: listener.Port ?? 0,
              protocol: listener.Protocol ?? "",
              rules,
            };
          })
        );
        return {
          name: lb.LoadBalancerName ?? "",
          dnsName: lb.DNSName ?? "",
          scheme: lb.Scheme ?? "",
          state: lb.State?.Code ?? "",
          type: lb.Type ?? "",
          listeners,
        };
      })
    );

    return NextResponse.json({ loadBalancers: results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
