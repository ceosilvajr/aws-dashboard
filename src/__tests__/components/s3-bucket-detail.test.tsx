// src/__tests__/components/s3-bucket-detail.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { S3BucketDetail } from "@/components/sections/s3-bucket-detail";

const MOCK_DETAIL = {
  bucket: "my-bucket",
  region: "ap-southeast-1",
  versioningStatus: "Enabled",
  publicAccessBlocked: true,
  publicAccessBlockConfig: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
  encryption: "SSE-KMS",
  encryptionConfig: [],
  lifecycleRules: [{ ID: "rule-1", Status: "Enabled" }],
  replicationRules: [],
  hasReplication: false,
  policy: null,
  policyRisk: false,
  corsRules: [],
  loggingTarget: "log-bucket",
  loggingPrefix: "logs/",
  tags: [{ Key: "env", Value: "prod" }],
  notificationLambdaFunctions: [],
  notificationSqsQueues: [],
  notificationSnsTopics: [],
  ownershipRule: "BucketOwnerPreferred",
};

const MOCK_OBJECTS = {
  objects: [
    { key: "file1.txt", size: 1024, storageClass: "STANDARD", lastModified: "2024-01-01T00:00:00.000Z", etag: '"abc123"' },
  ],
  commonPrefixes: ["folder1/"],
  nextContinuationToken: null,
  isTruncated: false,
  keyCount: 1,
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("S3BucketDetail", () => {
  it("renders bucket detail overview", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": MOCK_DETAIL,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    const onBack = vi.fn();
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={onBack} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-bucket")).toBeInTheDocument());
    // Shows versioning and encryption info
    await waitFor(() => expect(screen.getByText("SSE-KMS")).toBeInTheDocument());
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("calls onBack when Back button is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": MOCK_DETAIL,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    const onBack = vi.fn();
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={onBack} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("switches to Objects tab and shows file list", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": MOCK_DETAIL,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Objects")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Objects"));

    await waitFor(() => expect(screen.getByText("file1.txt")).toBeInTheDocument());
  });

  it("switches to Security tab", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": MOCK_DETAIL,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Security")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Security"));

    // Should show security details
    await waitFor(() => expect(screen.getAllByText("my-bucket").length).toBeGreaterThan(0));
  });

  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // never resolves
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });
    expect(screen.getByText(/Loading resources/i)).toBeInTheDocument();
  });

  it("handles public access not blocked", async () => {
    const detailWithPublicAccess = { ...MOCK_DETAIL, publicAccessBlocked: false };
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": detailWithPublicAccess,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Partially open")).toBeInTheDocument());
  });

  it("handles unknown public access status (null)", async () => {
    const detailWithNull = { ...MOCK_DETAIL, publicAccessBlocked: null };
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": detailWithNull,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Unknown")).toBeInTheDocument());
  });

  it("shows security tab with policy risk warning", async () => {
    const detailWithRisk = {
      ...MOCK_DETAIL,
      policyRisk: true,
      policy: JSON.stringify({ Statement: [{ Principal: "*", Effect: "Allow", Action: "s3:GetObject" }] }),
      corsRules: [{ AllowedMethods: ["GET"], AllowedOrigins: ["*"] }],
    };
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": detailWithRisk,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Security")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Security"));

    await waitFor(() => expect(screen.getByText(/World-readable policy/i)).toBeInTheDocument());
  });

  it("shows event notifications when present", async () => {
    const detailWithNotifications = {
      ...MOCK_DETAIL,
      notificationLambdaFunctions: [{}],
      notificationSqsQueues: [{}],
      notificationSnsTopics: [{}],
    };
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/s3/detail": detailWithNotifications,
      "/api/s3/objects": MOCK_OBJECTS,
    }));
    renderWithProviders(<S3BucketDetail bucket="my-bucket" onBack={vi.fn()} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Event Notifications")).toBeInTheDocument());
    expect(screen.getByText("1 Lambda function(s)")).toBeInTheDocument();
    expect(screen.getByText("1 SQS queue(s)")).toBeInTheDocument();
    expect(screen.getByText("1 SNS topic(s)")).toBeInTheDocument();
  });
});
