import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromIni } from "@aws-sdk/credential-providers";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = request.nextUrl.searchParams.get("region") ?? "us-east-1";
  const bucket = request.nextUrl.searchParams.get("bucket");
  const key = request.nextUrl.searchParams.get("key");

  if (!profile || !bucket || !key || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile, bucket, and key required" }, { status: 400 });
  }

  try {
    // Instantiate directly so the S3Client version matches the presigner package
    const s3 = new S3Client({ region, credentials: fromIni({ profile }) });
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
    return NextResponse.json({ url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
