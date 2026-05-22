import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = request.nextUrl.searchParams.get("region") ?? "us-east-1";
  const bucket = request.nextUrl.searchParams.get("bucket");
  const prefix = request.nextUrl.searchParams.get("prefix") ?? "";
  const continuationToken = request.nextUrl.searchParams.get("continuationToken") ?? undefined;

  if (!profile || !bucket || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile and bucket required" }, { status: 400 });
  }

  try {
    const s3 = createClient(S3Client, profile, region);
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: "/",
      MaxKeys: 100,
      ContinuationToken: continuationToken,
    }));

    return NextResponse.json({
      objects: (res.Contents ?? []).map((o) => ({
        key: o.Key ?? "",
        size: o.Size ?? 0,
        storageClass: o.StorageClass ?? "",
        lastModified: o.LastModified?.toISOString() ?? "",
        etag: o.ETag ?? "",
      })),
      commonPrefixes: (res.CommonPrefixes ?? []).map((p) => p.Prefix ?? ""),
      nextContinuationToken: res.NextContinuationToken ?? null,
      isTruncated: res.IsTruncated ?? false,
      keyCount: res.KeyCount ?? 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
