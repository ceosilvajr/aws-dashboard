import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const type = request.nextUrl.searchParams.get("type"); // s3 | dynamodb
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    if (type === "dynamodb") {
      const ddb = createClient(DynamoDBClient, profile);
      const { TableNames = [] } = await ddb.send(new ListTablesCommand({}));
      const tables = await Promise.all(
        TableNames.map(async (name) => {
          try {
            const { Table } = await ddb.send(new DescribeTableCommand({ TableName: name }));
            return {
              name,
              status: Table?.TableStatus ?? "",
              itemCount: Table?.ItemCount ?? 0,
              sizeBytes: Table?.TableSizeBytes ?? 0,
              billingMode: Table?.BillingModeSummary?.BillingMode ?? "PROVISIONED",
              created: Table?.CreationDateTime?.toISOString() ?? "",
            };
          } catch { return { name, status: "UNKNOWN", itemCount: 0, sizeBytes: 0, billingMode: "", created: "" }; }
        })
      );
      return NextResponse.json({ tables });
    }

    // Default: S3
    const s3 = createClient(S3Client, profile);
    const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));
    const buckets = Buckets.map((b) => ({
      name: b.Name ?? "",
      created: b.CreationDate?.toISOString() ?? "",
    }));
    return NextResponse.json({ buckets });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
