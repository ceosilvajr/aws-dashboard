import { NextRequest, NextResponse } from "next/server";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const bucket = request.nextUrl.searchParams.get("bucket");
  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10);

  if (!profile || !bucket || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile and bucket required" }, { status: 400 });
  }

  try {
    // CloudWatch S3 metrics are always in us-east-1 regardless of bucket region
    const cw = createClient(CloudWatchClient, profile, "us-east-1");
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [sizeRes, countRes] = await Promise.all([
      cw.send(new GetMetricStatisticsCommand({
        Namespace: "AWS/S3", MetricName: "BucketSizeBytes",
        Dimensions: [{ Name: "BucketName", Value: bucket }, { Name: "StorageType", Value: "StandardStorage" }],
        StartTime: start, EndTime: now, Period: 86400, Statistics: ["Average"],
      })),
      cw.send(new GetMetricStatisticsCommand({
        Namespace: "AWS/S3", MetricName: "NumberOfObjects",
        Dimensions: [{ Name: "BucketName", Value: bucket }, { Name: "StorageType", Value: "AllStorageTypes" }],
        StartTime: start, EndTime: now, Period: 86400, Statistics: ["Average"],
      })),
    ]);

    // Merge by timestamp
    const sizeMap = new Map((sizeRes.Datapoints ?? []).map((d) => [d.Timestamp?.toISOString().split("T")[0], d.Average ?? 0]));
    const countMap = new Map((countRes.Datapoints ?? []).map((d) => [d.Timestamp?.toISOString().split("T")[0], d.Average ?? 0]));
    const dates = [...new Set([...sizeMap.keys(), ...countMap.keys()])].sort();

    const series = dates.map((t) => ({ t, size: sizeMap.get(t) ?? 0, count: countMap.get(t) ?? 0 }));
    return NextResponse.json({ series });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
