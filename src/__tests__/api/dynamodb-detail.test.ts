// src/__tests__/api/dynamodb-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function () { return { send: mockSend }; }),
  DescribeTableCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { GET } from "@/app/api/dynamodb/detail/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/dynamodb/detail", () => {
  it("returns 400 when tableName or profile missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when profile missing but tableName present", async () => {
    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?tableName=my-table"));
    expect(res.status).toBe(400);
  });

  it("returns table detail with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      Table: {
        KeySchema: [
          { KeyType: "HASH", AttributeName: "userId" },
          { KeyType: "RANGE", AttributeName: "createdAt" },
        ],
        GlobalSecondaryIndexes: [{
          IndexName: "email-index",
          KeySchema: [{ KeyType: "HASH", AttributeName: "email" }],
          Projection: { ProjectionType: "ALL" },
          IndexStatus: "ACTIVE",
        }],
        LocalSecondaryIndexes: [{
          IndexName: "status-index",
          KeySchema: [
            { KeyType: "HASH", AttributeName: "userId" },
            { KeyType: "RANGE", AttributeName: "status" },
          ],
          Projection: { ProjectionType: "KEYS_ONLY" },
        }],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?profile=proj-prod&tableName=my-table"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      pk: "userId",
      sk: "createdAt",
    });
    expect(data.indexes).toHaveLength(2);
    expect(data.indexes[0]).toMatchObject({ name: "email-index", type: "GSI" });
    expect(data.indexes[1]).toMatchObject({ name: "status-index", type: "LSI" });
  });

  it("returns 404 when table not found", async () => {
    mockSend.mockResolvedValueOnce({ Table: undefined });
    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?profile=proj-prod&tableName=missing-table"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("ResourceNotFoundException"));
    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?profile=proj-prod&tableName=my-table"));
    expect(res.status).toBe(500);
  });

  it("handles table with no sort key (HASH only)", async () => {
    mockSend.mockResolvedValueOnce({
      Table: {
        KeySchema: [{ KeyType: "HASH", AttributeName: "id" }],
        GlobalSecondaryIndexes: [],
        LocalSecondaryIndexes: [],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?profile=proj-prod&tableName=my-table"));
    const data = await res.json();
    expect(data.pk).toBe("id");
    expect(data.sk).toBeNull();
    expect(data.indexes).toHaveLength(0);
  });

  it("handles LSI with multiple keys and GSI with status", async () => {
    mockSend.mockResolvedValueOnce({
      Table: {
        KeySchema: [{ KeyType: "HASH", AttributeName: "userId" }],
        GlobalSecondaryIndexes: [{
          IndexName: "status-gsi",
          KeySchema: [
            { KeyType: "HASH", AttributeName: "status" },
            { KeyType: "RANGE", AttributeName: "createdAt" },
          ],
          Projection: { ProjectionType: "KEYS_ONLY" },
          IndexStatus: "CREATING",
        }],
        LocalSecondaryIndexes: [{
          IndexName: "date-lsi",
          KeySchema: [
            { KeyType: "HASH", AttributeName: "userId" },
            { KeyType: "RANGE", AttributeName: "date" },
          ],
          Projection: { ProjectionType: "INCLUDE" },
        }],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?profile=proj-prod&tableName=my-table"));
    const data = await res.json();
    expect(data.indexes).toHaveLength(2);
    expect(data.indexes[0].type).toBe("GSI");
    expect(data.indexes[0].status).toBe("CREATING");
    expect(data.indexes[0].keys).toContain("SK");
    expect(data.indexes[1].type).toBe("LSI");
    expect(data.indexes[1].projection).toBe("INCLUDE");
  });

  it("handles indexes with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      Table: {
        KeySchema: [],
        GlobalSecondaryIndexes: [{
          IndexName: undefined,
          KeySchema: undefined, // null KeySchema
          Projection: undefined, // null Projection
          IndexStatus: undefined,
        }],
        LocalSecondaryIndexes: [{
          IndexName: undefined,
          KeySchema: undefined,
          Projection: undefined,
        }],
      },
    });

    const res = await GET(new NextRequest("http://localhost/api/dynamodb/detail?profile=proj-prod&tableName=my-table"));
    const data = await res.json();
    expect(data.pk).toBe("");
    expect(data.sk).toBeNull();
    expect(data.indexes[0].name).toBe("");
    expect(data.indexes[0].keys).toBe("");
    expect(data.indexes[0].projection).toBe("");
    expect(data.indexes[0].status).toBeUndefined();
  });
});
