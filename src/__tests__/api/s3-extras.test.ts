// src/__tests__/api/s3-extras.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send: mockSend }; }),
  ListBucketsCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
  GetObjectCommand: vi.fn(),
  GetPublicAccessBlockCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-cloudwatch", () => ({
  CloudWatchClient: vi.fn(function () { return { send: mockSend }; }),
  GetMetricStatisticsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET as summaryGET } from "@/app/api/s3/summary/route";
import { GET as metricsGET } from "@/app/api/s3/metrics/route";
import { GET as objectsGET } from "@/app/api/s3/objects/route";
import { GET as presignGET } from "@/app/api/s3/object/presign/route";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/s3/summary", () => {
  it("returns summary across all accounts", async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "bucket-1" }, { Name: "bucket-2" }] })
      .mockResolvedValueOnce({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } })
      .mockResolvedValueOnce({ PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false } });

    const res = await summaryGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalBuckets).toBe(2);
    expect(data.publicBuckets).toHaveLength(1);
    expect(data.publicBuckets[0].bucket).toBe("bucket-2");
    expect(data.perAccount).toHaveLength(1);
  });

  it("handles account fetch failure gracefully", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await summaryGET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalBuckets).toBe(0);
    expect(data.perAccount[0].bucketCount).toBe(0);
  });
});

describe("GET /api/s3/metrics", () => {
  it("returns 400 when required params missing", async () => {
    const res = await metricsGET(new NextRequest("http://localhost/api/s3/metrics"));
    expect(res.status).toBe(400);
  });

  it("returns metric series data", async () => {
    mockSend
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: new Date("2024-01-15"), Average: 1024 * 1024 * 100 },
          { Timestamp: new Date("2024-01-16"), Average: 1024 * 1024 * 110 },
        ],
      })
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: new Date("2024-01-15"), Average: 500 },
          { Timestamp: new Date("2024-01-16"), Average: 520 },
        ],
      });

    const res = await metricsGET(new NextRequest("http://localhost/api/s3/metrics?profile=proj-prod&bucket=my-bucket&days=30"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.series).toHaveLength(2);
    expect(data.series[0]).toMatchObject({ size: expect.any(Number), count: expect.any(Number) });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await metricsGET(new NextRequest("http://localhost/api/s3/metrics?profile=proj-prod&bucket=my-bucket"));
    expect(res.status).toBe(500);
  });

  it("handles empty datapoints (no data)", async () => {
    mockSend
      .mockResolvedValueOnce({ Datapoints: [] })
      .mockResolvedValueOnce({ Datapoints: [] });

    const res = await metricsGET(new NextRequest("http://localhost/api/s3/metrics?profile=proj-prod&bucket=my-bucket"));
    const data = await res.json();
    expect(data.series).toHaveLength(0);
  });

  it("handles metrics with only size data (count missing for some dates)", async () => {
    mockSend
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: new Date("2024-01-15"), Average: 1024 },
          { Timestamp: new Date("2024-01-16"), Average: 2048 },
        ],
      })
      .mockResolvedValueOnce({
        Datapoints: [
          { Timestamp: new Date("2024-01-16"), Average: 100 }, // only 1 date has count
        ],
      });

    const res = await metricsGET(new NextRequest("http://localhost/api/s3/metrics?profile=proj-prod&bucket=my-bucket&days=7"));
    const data = await res.json();
    expect(data.series).toHaveLength(2);
    // 2024-01-15 has size but no count (count=0)
    const jan15 = data.series.find((s: { t: string }) => s.t === "2024-01-15");
    expect(jan15.size).toBe(1024);
    expect(jan15.count).toBe(0); // ?? 0 fallback
    // 2024-01-16 has both
    const jan16 = data.series.find((s: { t: string }) => s.t === "2024-01-16");
    expect(jan16.size).toBe(2048);
    expect(jan16.count).toBe(100);
  });
});

describe("GET /api/s3/objects", () => {
  it("returns 400 when required params missing", async () => {
    const res = await objectsGET(new NextRequest("http://localhost/api/s3/objects"));
    expect(res.status).toBe(400);
  });

  it("returns paginated object list", async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: "folder/file.txt", Size: 1024, StorageClass: "STANDARD", LastModified: new Date(), ETag: '"abc123"' },
      ],
      CommonPrefixes: [{ Prefix: "folder/" }],
      NextContinuationToken: null,
      IsTruncated: false,
      KeyCount: 1,
    });

    const res = await objectsGET(new NextRequest("http://localhost/api/s3/objects?profile=proj-prod&bucket=my-bucket&prefix=folder/"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.objects).toHaveLength(1);
    expect(data.objects[0]).toMatchObject({ key: "folder/file.txt", size: 1024 });
    expect(data.commonPrefixes).toHaveLength(1);
  });

  it("handles continuation token", async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [{ Key: "file2.txt", Size: 512, StorageClass: "STANDARD", LastModified: new Date(), ETag: '"def456"' }],
      CommonPrefixes: [],
      NextContinuationToken: "page3token",
      IsTruncated: true,
      KeyCount: 1,
    });

    const res = await objectsGET(new NextRequest("http://localhost/api/s3/objects?profile=proj-prod&bucket=my-bucket&continuationToken=page2token"));
    const data = await res.json();
    expect(data.nextContinuationToken).toBe("page3token");
    expect(data.isTruncated).toBe(true);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("NoSuchBucket"));
    const res = await objectsGET(new NextRequest("http://localhost/api/s3/objects?profile=proj-prod&bucket=bad-bucket"));
    expect(res.status).toBe(500);
  });

  it("handles objects with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: undefined, Size: undefined, StorageClass: undefined, LastModified: undefined, ETag: undefined },
      ],
      CommonPrefixes: [{ Prefix: undefined }], // null Prefix
      NextContinuationToken: undefined,
      IsTruncated: undefined,
      KeyCount: undefined,
    });

    const res = await objectsGET(new NextRequest("http://localhost/api/s3/objects?profile=proj-prod&bucket=my-bucket"));
    const data = await res.json();
    expect(data.objects[0].key).toBe("");
    expect(data.objects[0].size).toBe(0);
    expect(data.objects[0].storageClass).toBe("");
    expect(data.objects[0].lastModified).toBe("");
    expect(data.objects[0].etag).toBe("");
    expect(data.commonPrefixes[0]).toBe("");
    expect(data.nextContinuationToken).toBeNull();
    expect(data.isTruncated).toBe(false);
    expect(data.keyCount).toBe(0);
  });
});

describe("GET /api/s3/object/presign", () => {
  it("returns 400 when required params missing", async () => {
    const res = await presignGET(new NextRequest("http://localhost/api/s3/object/presign"));
    expect(res.status).toBe(400);
  });

  it("returns presigned URL", async () => {
    vi.mocked(getSignedUrl).mockResolvedValueOnce("https://my-bucket.s3.amazonaws.com/file.txt?X-Amz-Signature=abc");

    const res = await presignGET(new NextRequest("http://localhost/api/s3/object/presign?profile=proj-prod&bucket=my-bucket&key=file.txt"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("X-Amz-Signature");
  });

  it("returns 500 when presign fails", async () => {
    vi.mocked(getSignedUrl).mockRejectedValue(new Error("AccessDenied"));
    const res = await presignGET(new NextRequest("http://localhost/api/s3/object/presign?profile=proj-prod&bucket=my-bucket&key=file.txt"));
    expect(res.status).toBe(500);
  });
});
