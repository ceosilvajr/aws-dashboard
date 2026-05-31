// src/__tests__/api/s3-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send: mockSend }; }),
  GetBucketLocationCommand: vi.fn(),
  GetBucketVersioningCommand: vi.fn(),
  GetPublicAccessBlockCommand: vi.fn(),
  GetBucketEncryptionCommand: vi.fn(),
  GetBucketLifecycleConfigurationCommand: vi.fn(),
  GetBucketReplicationCommand: vi.fn(),
  GetBucketPolicyCommand: vi.fn(),
  GetBucketCorsCommand: vi.fn(),
  GetBucketLoggingCommand: vi.fn(),
  GetBucketTaggingCommand: vi.fn(),
  GetBucketNotificationConfigurationCommand: vi.fn(),
  GetBucketOwnershipControlsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/s3/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/s3/detail", () => {
  it("returns 400 when profile or bucket missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/s3/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when profile missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/s3/detail?bucket=my-bucket"));
    expect(res.status).toBe(400);
  });

  it("returns bucket detail with correct shape", async () => {
    // All 12 safe() calls return appropriate mock data
    mockSend
      .mockResolvedValueOnce({ LocationConstraint: "ap-southeast-1" }) // location
      .mockResolvedValueOnce({ Status: "Enabled" }) // versioning
      .mockResolvedValueOnce({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } }) // pab
      .mockResolvedValueOnce({ ServerSideEncryptionConfiguration: { Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "aws:kms" } }] } }) // enc
      .mockResolvedValueOnce({ Rules: [] }) // lifecycle
      .mockResolvedValueOnce({ ReplicationConfiguration: { Rules: [] } }) // replication
      .mockResolvedValueOnce({ Policy: JSON.stringify({ Statement: [{ Principal: "aws:iam::111:root" }] }) }) // policy (no risk)
      .mockResolvedValueOnce({ CORSRules: [] }) // cors
      .mockResolvedValueOnce({ LoggingEnabled: { TargetBucket: "log-bucket", TargetPrefix: "logs/" } }) // logging
      .mockResolvedValueOnce({ TagSet: [{ Key: "env", Value: "prod" }] }) // tags
      .mockResolvedValueOnce({ LambdaFunctionConfigurations: [], QueueConfigurations: [], TopicConfigurations: [] }) // notifications
      .mockResolvedValueOnce({ OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerPreferred" }] } }); // ownership

    const res = await GET(new NextRequest("http://localhost/api/s3/detail?profile=proj-prod&bucket=my-bucket"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      bucket: "my-bucket",
      region: "ap-southeast-1",
      versioningStatus: "Enabled",
      publicAccessBlocked: true,
      encryption: "SSE-KMS",
      loggingTarget: "log-bucket",
    });
    expect(data.tags).toHaveLength(1);
    expect(data.policyRisk).toBe(false);
  });

  it("detects public bucket policy risk", async () => {
    mockSend
      .mockResolvedValueOnce(null) // location
      .mockResolvedValueOnce(null) // versioning
      .mockResolvedValueOnce(null) // pab
      .mockResolvedValueOnce(null) // enc
      .mockResolvedValueOnce(null) // lifecycle
      .mockResolvedValueOnce(null) // replication
      .mockResolvedValueOnce({ Policy: JSON.stringify({ Statement: [{ Principal: "*", Effect: "Allow", Action: "s3:GetObject", Resource: "arn:aws:s3:::my-bucket/*" }] }) })
      .mockResolvedValueOnce(null) // cors
      .mockResolvedValueOnce(null) // logging
      .mockResolvedValueOnce(null) // tags
      .mockResolvedValueOnce(null) // notifications
      .mockResolvedValueOnce(null); // ownership

    const res = await GET(new NextRequest("http://localhost/api/s3/detail?profile=proj-prod&bucket=my-bucket"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.policyRisk).toBe(true);
  });

  it("handles all safe() calls failing gracefully", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));

    const res = await GET(new NextRequest("http://localhost/api/s3/detail?profile=proj-prod&bucket=my-bucket"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.publicAccessBlocked).toBeNull();
    expect(data.encryption).toBe("none");
  });

  it("handles policy with AWS: * Principal with Condition (no risk)", async () => {
    mockSend
      .mockResolvedValueOnce(null) // location
      .mockResolvedValueOnce(null) // versioning
      .mockResolvedValueOnce(null) // pab
      .mockResolvedValueOnce(null) // enc
      .mockResolvedValueOnce(null) // lifecycle
      .mockResolvedValueOnce(null) // replication
      .mockResolvedValueOnce({
        Policy: JSON.stringify({
          Statement: [
            // Principal: * WITH Condition - should NOT be flagged as risk
            { Principal: "*", Effect: "Allow", Action: "s3:GetObject", Condition: { StringEquals: { "aws:sourceVpc": "vpc-123" } } },
            // Principal object with AWS: * and no Condition - should be flagged
          ],
        }),
      })
      .mockResolvedValueOnce(null) // cors
      .mockResolvedValueOnce(null) // logging
      .mockResolvedValueOnce(null) // tags
      .mockResolvedValueOnce(null) // notifications
      .mockResolvedValueOnce(null); // ownership

    const res = await GET(new NextRequest("http://localhost/api/s3/detail?profile=proj-prod&bucket=my-bucket"));
    const data = await res.json();
    expect(data.policyRisk).toBe(false); // has Condition, so not risky
  });

  it("detects AWS: * Principal object risk", async () => {
    mockSend
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        Policy: JSON.stringify({
          Statement: [{
            Principal: { AWS: "*" }, // Object form with no Condition
            Effect: "Allow",
            Action: "s3:*",
          }],
        }),
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const res = await GET(new NextRequest("http://localhost/api/s3/detail?profile=proj-prod&bucket=my-bucket"));
    const data = await res.json();
    expect(data.policyRisk).toBe(true);
  });

  it("handles invalid JSON policy gracefully", async () => {
    mockSend
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ Policy: "INVALID_JSON{{{" }) // invalid JSON
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const res = await GET(new NextRequest("http://localhost/api/s3/detail?profile=proj-prod&bucket=my-bucket"));
    const data = await res.json();
    expect(data.policyRisk).toBe(false); // parse error means no risk detected
    expect(data.policy).toBe("INVALID_JSON{{{");
  });
});
