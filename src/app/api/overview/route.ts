import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { ECRClient, DescribeRepositoriesCommand } from "@aws-sdk/client-ecr";
import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import { CloudFormationClient, ListStacksCommand } from "@aws-sdk/client-cloudformation";
import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

async function safeCount<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile) return NextResponse.json({ error: "profile required" }, { status: 400 });

  const account = (await getAccounts()).find((a) => a.profile === profile);
  if (!account) return NextResponse.json({ error: "unknown profile" }, { status: 400 });

  const region = getRegion(request);

  const [s3, dynamo, ecr, cf, lambda, cfn, cost] = await Promise.all([
    safeCount(async () => {
      const c = createClient(S3Client, profile, region);
      const r = await c.send(new ListBucketsCommand({}));
      return r.Buckets?.length ?? 0;
    }),
    safeCount(async () => {
      const c = createClient(DynamoDBClient, profile, region);
      const r = await c.send(new ListTablesCommand({}));
      return r.TableNames?.length ?? 0;
    }),
    safeCount(async () => {
      const c = createClient(ECRClient, profile, region);
      const r = await c.send(new DescribeRepositoriesCommand({}));
      return r.repositories?.length ?? 0;
    }),
    safeCount(async () => {
      const c = createClient(CloudFrontClient, profile, "us-east-1");
      const r = await c.send(new ListDistributionsCommand({}));
      return r.DistributionList?.Quantity ?? 0;
    }),
    safeCount(async () => {
      const c = createClient(LambdaClient, profile, region);
      const r = await c.send(new ListFunctionsCommand({}));
      return r.Functions?.length ?? 0;
    }),
    safeCount(async () => {
      const c = createClient(CloudFormationClient, profile, region);
      const r = await c.send(new ListStacksCommand({
        StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"],
      }));
      return r.StackSummaries?.length ?? 0;
    }),
    safeCount(async () => {
      const ce = createClient(CostExplorerClient, profile, "us-east-1");
      const now = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const r = await ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: start, End: end },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      }));
      const groups = r.ResultsByTime?.[0]?.Groups ?? [];
      const total = groups.reduce((sum, g) => sum + parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0"), 0);
      const topServices = groups
        .map((g) => ({ name: g.Keys?.[0] ?? "", cost: parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0") }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
        .map((s) => ({ name: s.name, cost: s.cost.toFixed(2) }));

      // Forecast for end of month
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      let forecast: string | null = null;
      if (now.getDate() > 1) {
        try {
          const fRes = await ce.send(new GetCostForecastCommand({
            TimePeriod: { Start: end, End: monthEnd },
            Granularity: "MONTHLY",
            Metric: "UNBLENDED_COST",
          }));
          const forecastAmount = parseFloat(fRes.Total?.Amount ?? "0");
          forecast = (total + forecastAmount).toFixed(2);
        } catch { forecast = null; }
      }

      return { total: total.toFixed(2), topServices, forecast };
    }),
  ]);

  return NextResponse.json({
    account: account.name,
    s3Buckets: s3,
    dynamoTables: dynamo,
    ecrRepos: ecr,
    cloudFrontDistributions: cf,
    lambdaFunctions: lambda,
    cfnStacks: cfn,
    monthlyCost: cost?.total ?? null,
    forecastedCost: cost?.forecast ?? null,
    topServices: cost?.topServices ?? null,
    fetchedAt: new Date().toISOString(),
  });
}
