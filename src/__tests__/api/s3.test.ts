// src/__tests__/api/s3.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send: mockSend }; }),
  ListBucketsCommand: vi.fn(),
  GetBucketLocationCommand: vi.fn(),
  GetBucketVersioningCommand: vi.fn(),
  GetPublicAccessBlockCommand: vi.fn(),
  GetBucketEncryptionCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-cloudwatch", () => ({
  CloudWatchClient: vi.fn(function () { return { send: mockSend }; }),
  GetMetricStatisticsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/s3/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/s3", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/s3"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/s3?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns bucket list with correct shape", async () => {
    const now = new Date();
    mockSend
      .mockResolvedValueOnce({
        Buckets: [{ Name: "my-bucket", CreationDate: new Date("2023-01-01") }],
      })
      // getBucketDetails calls for "my-bucket":
      .mockResolvedValueOnce({ LocationConstraint: "ap-southeast-1" }) // location
      .mockResolvedValueOnce({ Status: "Enabled" }) // versioning
      .mockResolvedValueOnce({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      }) // public access block
      .mockResolvedValueOnce({
        ServerSideEncryptionConfiguration: {
          Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "aws:kms" } }],
        },
      }) // encryption
      .mockResolvedValueOnce({ // CW size metric
        Datapoints: [{ Timestamp: now, Average: 1024 * 1024 }],
      })
      .mockResolvedValueOnce({ // CW count metric
        Datapoints: [{ Timestamp: now, Average: 100 }],
      });

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buckets).toHaveLength(1);
    expect(data.buckets[0]).toMatchObject({
      name: "my-bucket",
      region: "ap-southeast-1",
      versioningStatus: "Enabled",
      publicAccessBlocked: true,
      encryption: "SSE-KMS",
    });
    expect(data.fetchedAt).toBeDefined();
  });

  it("handles SSE-S3 encryption", async () => {
    const now = new Date();
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "my-bucket", CreationDate: new Date() }] })
      .mockResolvedValueOnce({ LocationConstraint: "us-east-1" })
      .mockResolvedValueOnce({ Status: "Disabled" })
      .mockResolvedValueOnce({ PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false } })
      .mockResolvedValueOnce({ ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }] } })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: now, Average: 0 }] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: now, Average: 0 }] });

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    const data = await res.json();
    expect(data.buckets[0].encryption).toBe("SSE-S3");
    expect(data.buckets[0].publicAccessBlocked).toBe(false);
  });

  it("returns 500 when SDK throws on list buckets", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles individual bucket detail errors gracefully", async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "my-bucket", CreationDate: new Date() }] })
      .mockRejectedValue(new Error("AccessDenied")); // all detail calls fail

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // bucket still included but with fallback values
    expect(data.buckets).toHaveLength(1);
    expect(data.buckets[0].publicAccessBlocked).toBeNull();
  });

  it("handles partial PAB config (some fields blocked)", async () => {
    const now = new Date();
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "partial-bucket", CreationDate: new Date() }] })
      .mockResolvedValueOnce({ LocationConstraint: "ap-southeast-1" })
      .mockResolvedValueOnce({ Status: "Enabled" })
      .mockResolvedValueOnce({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: false, // not all blocked
          IgnorePublicAcls: true,
          RestrictPublicBuckets: false,
        },
      })
      .mockResolvedValueOnce({ ServerSideEncryptionConfiguration: { Rules: [] } }) // no encryption rules = "none"
      .mockResolvedValueOnce({ Datapoints: [] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: now, Average: 50 }] });

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    const data = await res.json();
    expect(data.buckets[0].publicAccessBlocked).toBe(false); // not all blocked
    expect(data.buckets[0].encryption).toBe("none");
  });

  it("handles multiple buckets in batches", async () => {
    const now = new Date();
    // Create 7 buckets to test the limitedMap batch logic (limit=5)
    const buckets = Array.from({ length: 7 }, (_, i) => ({ Name: `bucket-${i}`, CreationDate: new Date() }));
    mockSend.mockResolvedValueOnce({ Buckets: buckets });
    // 7 buckets * 6 calls each = 42 calls
    for (let i = 0; i < 7; i++) {
      mockSend
        .mockResolvedValueOnce({ LocationConstraint: "ap-southeast-1" })
        .mockResolvedValueOnce({ Status: "Disabled" })
        .mockResolvedValueOnce(null) // PAB fails
        .mockResolvedValueOnce(null) // encryption fails
        .mockResolvedValueOnce({ Datapoints: [] })
        .mockResolvedValueOnce({ Datapoints: [] });
    }

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    const data = await res.json();
    expect(data.buckets).toHaveLength(7);
  });

  it("handles null/undefined LocationConstraint (defaults to us-east-1)", async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "us-east-bucket", CreationDate: new Date() }] })
      .mockResolvedValueOnce({ LocationConstraint: null }) // null = us-east-1
      .mockResolvedValueOnce({ Status: "Suspended" })
      .mockResolvedValueOnce({
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: null, // null field means not all blocked
        },
      })
      .mockResolvedValueOnce({ ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "UNKNOWN" } }] } })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: new Date(), Average: 5000 }] })
      .mockResolvedValueOnce({ Datapoints: [] });

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    const data = await res.json();
    expect(data.buckets[0].region).toBe("us-east-1");
    expect(data.buckets[0].versioningStatus).toBe("Suspended");
    expect(data.buckets[0].publicAccessBlocked).toBe(false);
    expect(data.buckets[0].encryption).toBe("none");
  });

  it("handles CW datapoints sorting (most recent first)", async () => {
    const date1 = new Date("2024-01-15");
    const date2 = new Date("2024-01-20"); // more recent
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "my-bucket", CreationDate: new Date() }] })
      .mockResolvedValueOnce({ LocationConstraint: "ap-southeast-1" })
      .mockResolvedValueOnce({ Status: "Enabled" })
      .mockResolvedValueOnce({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } })
      .mockResolvedValueOnce({ ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "aws:kms" } }] } })
      .mockResolvedValueOnce({ Datapoints: [
        { Timestamp: date1, Average: 1000 },
        { Timestamp: date2, Average: 2000 }, // more recent, should be used
      ] })
      .mockResolvedValueOnce({ Datapoints: [{ Timestamp: date2, Average: 50 }] });

    const res = await GET(new NextRequest("http://localhost/api/s3?profile=proj-prod"));
    const data = await res.json();
    expect(data.buckets[0].sizeBytes).toBe(2000);
    expect(data.buckets[0].objectCount).toBe(50);
  });
});
