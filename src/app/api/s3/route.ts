import { NextRequest, NextResponse } from "next/server";
import {
  S3Client, ListBucketsCommand, GetBucketLocationCommand,
  GetBucketVersioningCommand, GetPublicAccessBlockCommand, GetBucketEncryptionCommand,
} from "@aws-sdk/client-s3";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export interface BucketSummary {
  name: string;
  region: string;
  created: string;
  sizeBytes: number;
  objectCount: number;
  versioningStatus: string;
  publicAccessBlocked: boolean | null;
  encryption: string;
}

async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function getBucketDetails(s3: S3Client, cw: CloudWatchClient, name: string): Promise<BucketSummary> {
  const [locationRes, versioningRes, pabRes, encRes] = await Promise.all([
    withFallback(() => s3.send(new GetBucketLocationCommand({ Bucket: name })), null),
    withFallback(() => s3.send(new GetBucketVersioningCommand({ Bucket: name })), null),
    withFallback(() => s3.send(new GetPublicAccessBlockCommand({ Bucket: name })), null),
    withFallback(() => s3.send(new GetBucketEncryptionCommand({ Bucket: name })), null),
  ]);

  const bucketRegion = locationRes?.LocationConstraint ?? "us-east-1";

  // CloudWatch S3 metrics are always in us-east-1 regardless of bucket region
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const [sizeRes, countRes] = await Promise.all([
    withFallback(() => cw.send(new GetMetricStatisticsCommand({
      Namespace: "AWS/S3", MetricName: "BucketSizeBytes",
      Dimensions: [{ Name: "BucketName", Value: name }, { Name: "StorageType", Value: "StandardStorage" }],
      StartTime: start, EndTime: now, Period: 86400, Statistics: ["Average"],
    })), null),
    withFallback(() => cw.send(new GetMetricStatisticsCommand({
      Namespace: "AWS/S3", MetricName: "NumberOfObjects",
      Dimensions: [{ Name: "BucketName", Value: name }, { Name: "StorageType", Value: "AllStorageTypes" }],
      StartTime: start, EndTime: now, Period: 86400, Statistics: ["Average"],
    })), null),
  ]);

  const latestSize = sizeRes?.Datapoints?.sort((a, b) => (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0))[0]?.Average ?? 0;
  const latestCount = countRes?.Datapoints?.sort((a, b) => (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0))[0]?.Average ?? 0;

  const pab = pabRes?.PublicAccessBlockConfiguration;
  const allBlocked = pab
    ? (pab.BlockPublicAcls && pab.BlockPublicPolicy && pab.IgnorePublicAcls && pab.RestrictPublicBuckets) ?? false
    : null;

  const encAlgo = encRes?.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
  const encryption = encAlgo === "aws:kms" ? "SSE-KMS" : encAlgo === "AES256" ? "SSE-S3" : "none";

  return {
    name,
    region: bucketRegion,
    created: "",
    sizeBytes: Math.round(latestSize),
    objectCount: Math.round(latestCount),
    versioningStatus: versioningRes?.Status ?? "Disabled",
    publicAccessBlocked: allBlocked,
    encryption,
  };
}

async function limitedMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = await Promise.all(items.slice(i, i + limit).map(fn));
    results.push(...batch);
  }
  return results;
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = request.nextUrl.searchParams.get("region") ?? "us-east-1";

  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const s3 = createClient(S3Client, profile, region);
    const cw = createClient(CloudWatchClient, profile, "us-east-1"); // CW S3 metrics are global
    const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));

    const buckets = await limitedMap(Buckets, 5, async (b) => {
      const details = await getBucketDetails(s3, cw, b.Name ?? "");
      return { ...details, created: b.CreationDate?.toISOString() ?? "" };
    });

    return NextResponse.json({ buckets, fetchedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
