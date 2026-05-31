// src/__tests__/api/dynamodb.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function () { return { send: mockSend }; }),
  ListTablesCommand: vi.fn(),
  DescribeTableCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/dynamodb/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/dynamodb", () => {
  it("returns tables with correct shape for a specific profile", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["users-table"], LastEvaluatedTableName: undefined })
      .mockResolvedValueOnce({
        Table: {
          TableStatus: "ACTIVE",
          DeletionProtectionEnabled: true,
          TableSizeBytes: 1024,
          ItemCount: 100,
        },
      });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tables).toHaveLength(1);
    expect(data.tables[0]).toMatchObject({
      tableName: "users-table",
      status: "ACTIVE",
      deletionProtection: true,
      sizeBytes: 1024,
      itemCount: 100,
    });
    expect(data.fetchedAt).toBeDefined();
  });

  it("fans out across all accounts when no profile given", async () => {
    vi.mocked(getAccounts).mockResolvedValue([
      { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
      { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
    ]);
    mockSend.mockResolvedValue({ TableNames: [], LastEvaluatedTableName: undefined });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tables).toEqual([]);
  });

  it("returns empty tables when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/dynamodb?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tables).toEqual([]);
  });

  it("handles pagination with LastEvaluatedTableName", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["table1"], LastEvaluatedTableName: "table1" })
      .mockResolvedValueOnce({ TableNames: ["table2"], LastEvaluatedTableName: undefined })
      .mockResolvedValueOnce({ Table: { TableStatus: "ACTIVE", DeletionProtectionEnabled: false, TableSizeBytes: 0, ItemCount: 0 } })
      .mockResolvedValueOnce({ Table: { TableStatus: "ACTIVE", DeletionProtectionEnabled: false, TableSizeBytes: 0, ItemCount: 0 } });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tables).toHaveLength(2);
  });

  it("skips table when DescribeTable fails", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["good-table", "bad-table"], LastEvaluatedTableName: undefined })
      .mockResolvedValueOnce({ Table: { TableStatus: "ACTIVE", DeletionProtectionEnabled: false, TableSizeBytes: 0, ItemCount: 0 } })
      .mockRejectedValueOnce(new Error("ResourceNotFoundException"));

    const res = await GET(new NextRequest("http://localhost/api/dynamodb?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tables).toHaveLength(1);
  });

  it("handles table with null/undefined Table response", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["my-table"], LastEvaluatedTableName: undefined })
      .mockResolvedValueOnce({
        Table: {
          TableStatus: undefined,
          DeletionProtectionEnabled: undefined,
          TableSizeBytes: undefined,
          ItemCount: undefined,
        },
      });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb?profile=proj-prod"));
    const data = await res.json();
    expect(data.tables[0].status).toBe("UNKNOWN");
    expect(data.tables[0].deletionProtection).toBe(false);
    expect(data.tables[0].sizeBytes).toBe(0);
    expect(data.tables[0].itemCount).toBe(0);
  });
});
