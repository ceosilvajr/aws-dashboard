import { NextRequest, NextResponse } from "next/server";
import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const ce = createClient(CostExplorerClient, profile, "us-east-1");
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Get current cost by service
    const costRes = await ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    }));

    const groups = costRes.ResultsByTime?.[0]?.Groups ?? [];
    const services = groups
      .map((g) => ({ name: g.Keys?.[0] ?? "", runningCost: parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0") }))
      .filter((s) => s.runningCost > 0.01)
      .sort((a, b) => b.runningCost - a.runningCost);

    const totalRunning = services.reduce((sum, s) => sum + s.runningCost, 0);

    // Get forecast per service
    let forecastTotal: number | null = null;
    if (now.getDate() > 1) {
      try {
        const fRes = await ce.send(new GetCostForecastCommand({
          TimePeriod: { Start: end, End: monthEnd },
          Granularity: "MONTHLY",
          Metric: "UNBLENDED_COST",
        }));
        forecastTotal = totalRunning + parseFloat(fRes.Total?.Amount ?? "0");
      } catch { forecastTotal = null; }
    }

    // Calculate daily rate and project per service
    const daysElapsed = now.getDate() - 1 || 1;
    const serviceBreakdown = services.map((s) => {
      const dailyRate = s.runningCost / daysElapsed;
      const projected = dailyRate * lastDay;
      return {
        name: s.name,
        runningCost: s.runningCost.toFixed(2),
        projectedCost: projected.toFixed(2),
        dailyRate: dailyRate.toFixed(2),
      };
    });

    // Generate savings suggestions based on top services
    const suggestions = generateSuggestions(services);

    return NextResponse.json({
      totalRunningCost: totalRunning.toFixed(2),
      forecastedCost: forecastTotal?.toFixed(2) ?? null,
      daysElapsed,
      daysInMonth: lastDay,
      services: serviceBreakdown,
      suggestions,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}

function generateSuggestions(services: { name: string; runningCost: number }[]) {
  const suggestions: { service: string; suggestion: string; impact: string }[] = [];

  for (const s of services.slice(0, 10)) {
    const name = s.name.toLowerCase();
    if (name.includes("ec2") || name.includes("elastic compute")) {
      suggestions.push({ service: s.name, suggestion: "Consider using Reserved Instances or Savings Plans for steady-state workloads. Review instance sizing with AWS Compute Optimizer.", impact: "Up to 72% savings with 3-year RI" });
    } else if (name.includes("rds")) {
      suggestions.push({ service: s.name, suggestion: "Use Reserved Instances for production databases. Consider Aurora Serverless for variable workloads. Review Multi-AZ necessity for non-prod.", impact: "Up to 60% savings with RI" });
    } else if (name.includes("s3") || name.includes("simple storage")) {
      suggestions.push({ service: s.name, suggestion: "Implement S3 Lifecycle policies to transition infrequent data to Glacier. Enable S3 Intelligent-Tiering for unpredictable access patterns.", impact: "Up to 95% savings on archived data" });
    } else if (name.includes("cloudfront")) {
      suggestions.push({ service: s.name, suggestion: "Review cache hit ratio and increase TTLs where possible. Consider CloudFront Security Savings Bundle for committed usage.", impact: "Up to 30% savings with committed use" });
    } else if (name.includes("nat gateway")) {
      suggestions.push({ service: s.name, suggestion: "Consolidate NAT Gateways across AZs if HA is not critical. Consider VPC endpoints for S3/DynamoDB to reduce NAT traffic.", impact: "Reduce data processing charges significantly" });
    } else if (name.includes("lambda")) {
      suggestions.push({ service: s.name, suggestion: "Optimize function memory allocation using AWS Lambda Power Tuning. Reduce execution time by optimizing cold starts.", impact: "10-40% cost reduction" });
    } else if (name.includes("dynamodb")) {
      suggestions.push({ service: s.name, suggestion: "Switch to on-demand capacity for unpredictable workloads, or use Reserved Capacity for steady throughput. Enable auto-scaling.", impact: "Up to 77% savings with reserved capacity" });
    } else if (name.includes("elastic load") || name.includes("elb")) {
      suggestions.push({ service: s.name, suggestion: "Consolidate load balancers where possible. Remove idle ALBs with no targets.", impact: "~$16/month per idle ALB removed" });
    } else if (name.includes("ecs") || name.includes("fargate")) {
      suggestions.push({ service: s.name, suggestion: "Use Fargate Spot for fault-tolerant tasks. Right-size task CPU/memory. Consider Compute Savings Plans.", impact: "Up to 70% savings with Spot" });
    } else if (name.includes("secrets manager")) {
      suggestions.push({ service: s.name, suggestion: "Audit unused secrets and remove them. Consider using SSM Parameter Store (SecureString) for non-rotating secrets.", impact: "$0.40/secret/month savings" });
    }
  }

  return suggestions;
}
