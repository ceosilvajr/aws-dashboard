// src/__tests__/api/storage.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send: mockSend }; }),
  ListBucketsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function () { return { send: mockSend }; }),
  ListTablesCommand: vi.fn(),
  DescribeTableCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/storage/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/storage", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/storage"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/storage?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns S3 buckets by default", async () => {
    mockSend.mockResolvedValueOnce({
      Buckets: [
        { Name: "my-bucket-1", CreationDate: new Date("2023-01-01") },
        { Name: "my-bucket-2", CreationDate: new Date("2023-02-01") },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buckets).toHaveLength(2);
    expect(data.buckets[0]).toMatchObject({ name: "my-bucket-1" });
  });

  it("returns DynamoDB tables when type=dynamodb", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["users-table"] })
      .mockResolvedValueOnce({
        Table: {
          TableStatus: "ACTIVE",
          ItemCount: 500,
          TableSizeBytes: 2048,
          BillingModeSummary: { BillingMode: "PAY_PER_REQUEST" },
          CreationDateTime: new Date("2023-01-01"),
        },
      });

    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod&type=dynamodb"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tables).toHaveLength(1);
    expect(data.tables[0]).toMatchObject({
      name: "users-table",
      status: "ACTIVE",
      itemCount: 500,
      billingMode: "PAY_PER_REQUEST",
    });
  });

  it("handles individual DynamoDB table errors with fallback values", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["good-table", "bad-table"] })
      .mockResolvedValueOnce({ Table: { TableStatus: "ACTIVE", ItemCount: 0, TableSizeBytes: 0 } })
      .mockRejectedValueOnce(new Error("ResourceNotFoundException"));

    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod&type=dynamodb"));
    const data = await res.json();
    expect(data.tables).toHaveLength(2);
    expect(data.tables[1]).toMatchObject({ name: "bad-table", status: "UNKNOWN" });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles S3 buckets with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      Buckets: [{ Name: undefined, CreationDate: undefined }],
    });

    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod"));
    const data = await res.json();
    expect(data.buckets[0].name).toBe("");
    expect(data.buckets[0].created).toBe("");
  });

  it("handles DynamoDB table with undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({ TableNames: ["my-table"] })
      .mockResolvedValueOnce({
        Table: {
          TableStatus: undefined,
          ItemCount: undefined,
          TableSizeBytes: undefined,
          BillingModeSummary: undefined,
          CreationDateTime: undefined,
        },
      });

    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod&type=dynamodb"));
    const data = await res.json();
    expect(data.tables[0].status).toBe("");
    expect(data.tables[0].itemCount).toBe(0);
    expect(data.tables[0].billingMode).toBe("PROVISIONED"); // default when BillingModeSummary is undefined
    expect(data.tables[0].created).toBe("");
  });

  it("handles empty TableNames response", async () => {
    mockSend.mockResolvedValueOnce({ TableNames: [] });
    const res = await GET(new NextRequest("http://localhost/api/storage?profile=proj-prod&type=dynamodb"));
    const data = await res.json();
    expect(data.tables).toHaveLength(0);
  });
});
