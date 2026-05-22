import { NextRequest, NextResponse } from "next/server";
import {
  S3Client, GetBucketLocationCommand, GetBucketVersioningCommand,
  GetPublicAccessBlockCommand, GetBucketEncryptionCommand, GetBucketLifecycleConfigurationCommand,
  GetBucketReplicationCommand, GetBucketPolicyCommand, GetBucketCorsCommand,
  GetBucketLoggingCommand, GetBucketTaggingCommand, GetBucketNotificationConfigurationCommand,
  GetBucketOwnershipControlsCommand,
} from "@aws-sdk/client-s3";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = request.nextUrl.searchParams.get("region") ?? "us-east-1";
  const bucket = request.nextUrl.searchParams.get("bucket");

  if (!profile || !bucket || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile and bucket required" }, { status: 400 });
  }

  const s3 = createClient(S3Client, profile, region);

  const [location, versioning, pab, enc, lifecycle, replication, policy, cors, logging, tags, notifications, ownership] = await Promise.all([
    safe(() => s3.send(new GetBucketLocationCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketVersioningCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetPublicAccessBlockCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketEncryptionCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketReplicationCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketPolicyCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketCorsCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketLoggingCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketTaggingCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketNotificationConfigurationCommand({ Bucket: bucket }))),
    safe(() => s3.send(new GetBucketOwnershipControlsCommand({ Bucket: bucket }))),
  ]);

  const pabConfig = pab?.PublicAccessBlockConfiguration;
  const allBlocked = pabConfig
    ? (pabConfig.BlockPublicAcls && pabConfig.BlockPublicPolicy && pabConfig.IgnorePublicAcls && pabConfig.RestrictPublicBuckets) ?? false
    : null;

  const encAlgo = enc?.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
  const encryption = encAlgo === "aws:kms" ? "SSE-KMS" : encAlgo === "AES256" ? "SSE-S3" : "none";

  const policyStr = policy?.Policy ?? null;
  let policyRisk = false;
  if (policyStr) {
    try {
      const parsed = JSON.parse(policyStr);
      const statements = Array.isArray(parsed.Statement) ? parsed.Statement : [];
      policyRisk = statements.some((s: { Principal?: string | Record<string, string | string[]>; Condition?: unknown }) =>
        (s.Principal === "*" || (typeof s.Principal === "object" && s.Principal?.AWS === "*")) && !s.Condition
      );
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    bucket,
    region: location?.LocationConstraint ?? "us-east-1",
    versioningStatus: versioning?.Status ?? "Disabled",
    publicAccessBlocked: allBlocked,
    publicAccessBlockConfig: pabConfig ?? null,
    encryption,
    encryptionConfig: enc?.ServerSideEncryptionConfiguration?.Rules ?? [],
    lifecycleRules: lifecycle?.Rules ?? [],
    replicationRules: replication?.ReplicationConfiguration?.Rules ?? [],
    hasReplication: (replication?.ReplicationConfiguration?.Rules?.length ?? 0) > 0,
    policy: policyStr,
    policyRisk,
    corsRules: cors?.CORSRules ?? [],
    loggingTarget: logging?.LoggingEnabled?.TargetBucket ?? null,
    loggingPrefix: logging?.LoggingEnabled?.TargetPrefix ?? null,
    tags: tags?.TagSet ?? [],
    notificationLambdaFunctions: notifications?.LambdaFunctionConfigurations ?? [],
    notificationSqsQueues: notifications?.QueueConfigurations ?? [],
    notificationSnsTopics: notifications?.TopicConfigurations ?? [],
    ownershipRule: ownership?.OwnershipControls?.Rules?.[0]?.ObjectOwnership ?? null,
  });
}
