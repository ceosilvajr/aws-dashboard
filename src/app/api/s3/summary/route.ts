import { NextResponse } from "next/server";
import { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand } from "@aws-sdk/client-s3";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

interface AccountSummary {
  account: string;
  profile: string;
  bucketCount: number;
  publicBuckets: string[];
}

async function fetchAccountSummary(profile: string, name: string): Promise<AccountSummary> {
  try {
    const s3 = createClient(S3Client, profile);
    const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));

    const publicBuckets: string[] = [];
    await Promise.all(Buckets.map(async (b) => {
      if (!b.Name) return;
      try {
        const pab = await s3.send(new GetPublicAccessBlockCommand({ Bucket: b.Name }));
        const c = pab.PublicAccessBlockConfiguration;
        const allBlocked = c?.BlockPublicAcls && c?.BlockPublicPolicy && c?.IgnorePublicAcls && c?.RestrictPublicBuckets;
        if (!allBlocked) publicBuckets.push(b.Name);
      } catch { /* bucket might not support PAB — count as potentially public */ }
    }));

    return { account: name, profile, bucketCount: Buckets.length, publicBuckets };
  } catch {
    return { account: name, profile, bucketCount: 0, publicBuckets: [] };
  }
}

export async function GET() {
  const accounts = await getAccounts();
  const perAccount = await Promise.all(accounts.map((a) => fetchAccountSummary(a.profile, a.name)));

  const totalBuckets = perAccount.reduce((s, a) => s + a.bucketCount, 0);
  const allPublicBuckets = perAccount.flatMap((a) => a.publicBuckets.map((b) => ({ account: a.account, bucket: b })));

  return NextResponse.json({ totalBuckets, publicBuckets: allPublicBuckets, perAccount });
}
