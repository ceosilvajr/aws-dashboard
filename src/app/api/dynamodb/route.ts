import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import { NextResponse, NextRequest } from "next/server";
import { getAccounts, Account } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export interface TableInfo {
  account: string;
  accountId: string;
  profile: string;
  tableName: string;
  status: string;
  deletionProtection: boolean;
  sizeBytes: number;
  itemCount: number;
}

async function fetchAccountData(account: Account, region: string): Promise<TableInfo[]> {
  const credentials = fromIni({ profile: account.profile });
  const dynamo = new DynamoDBClient({ region, credentials });

  try {
    const tableNames: string[] = [];
    let lastKey: string | undefined;

    do {
      const { TableNames, LastEvaluatedTableName } = await dynamo.send(
        new ListTablesCommand({ ExclusiveStartTableName: lastKey })
      );
      tableNames.push(...(TableNames ?? []));
      lastKey = LastEvaluatedTableName;
    } while (lastKey);

    const tables = await Promise.all(
      tableNames.map(async (name) => {
        try {
          const { Table } = await dynamo.send(new DescribeTableCommand({ TableName: name }));
          return {
            account: account.name as string,
            accountId: account.id as string,
            profile: account.profile as string,
            tableName: name,
            status: Table?.TableStatus ?? "UNKNOWN",
            deletionProtection: Table?.DeletionProtectionEnabled ?? false,
            sizeBytes: Table?.TableSizeBytes ?? 0,
            itemCount: Table?.ItemCount ?? 0,
          } as TableInfo;
        } catch {
          return null;
        }
      })
    );

    return tables.filter((t): t is TableInfo => t !== null);
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const region = getRegion(request);
  const accounts = await getAccounts();
  const targets = profile ? accounts.filter((a) => a.profile === profile) : accounts;
  const results = await Promise.all(targets.map((a) => fetchAccountData(a, region)));
  return NextResponse.json({ tables: results.flat(), fetchedAt: new Date().toISOString() });
}
