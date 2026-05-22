import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getRegion } from "@/lib/constants";

export interface IndexInfo {
  name: string;
  type: "GSI" | "LSI";
  keys: string;
  projection: string;
  status?: string;
}

export interface TableDetail {
  pk: string;
  sk: string | null;
  indexes: IndexInfo[];
}

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get("tableName");
  const profile = request.nextUrl.searchParams.get("profile");

  if (!tableName || !profile) {
    return NextResponse.json({ error: "tableName and profile are required" }, { status: 400 });
  }

  const dynamo = new DynamoDBClient({
    region: getRegion(request),
    credentials: fromIni({ profile }),
  });

  try {
    const { Table } = await dynamo.send(new DescribeTableCommand({ TableName: tableName }));
    if (!Table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const keySchema = Table.KeySchema ?? [];
    const pk = keySchema.find((k) => k.KeyType === "HASH")?.AttributeName ?? "";
    const sk = keySchema.find((k) => k.KeyType === "RANGE")?.AttributeName ?? null;

    const indexes: IndexInfo[] = [
      ...(Table.GlobalSecondaryIndexes ?? []).map((gsi) => ({
        name: gsi.IndexName ?? "",
        type: "GSI" as const,
        keys: (gsi.KeySchema ?? [])
          .map((k) => `${k.AttributeName} (${k.KeyType === "HASH" ? "PK" : "SK"})`)
          .join(", "),
        projection: gsi.Projection?.ProjectionType ?? "",
        status: gsi.IndexStatus,
      })),
      ...(Table.LocalSecondaryIndexes ?? []).map((lsi) => ({
        name: lsi.IndexName ?? "",
        type: "LSI" as const,
        keys: (lsi.KeySchema ?? [])
          .map((k) => `${k.AttributeName} (${k.KeyType === "HASH" ? "PK" : "SK"})`)
          .join(", "),
        projection: lsi.Projection?.ProjectionType ?? "",
      })),
    ];

    return NextResponse.json({ pk, sk, indexes } as TableDetail);
  } catch {
    return NextResponse.json({ error: "Failed to fetch table detail" }, { status: 500 });
  }
}
