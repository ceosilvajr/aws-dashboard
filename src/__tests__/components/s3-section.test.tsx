// src/__tests__/components/s3-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { S3Section } from "@/components/sections/s3-section";

const MOCK_BUCKETS = [
  {
    name: "my-app-bucket",
    region: "ap-southeast-1",
    created: "2023-01-01T00:00:00.000Z",
    sizeBytes: 1024 * 1024 * 500,
    objectCount: 1000,
    versioningStatus: "Enabled",
    publicAccessBlocked: true,
    encryption: "SSE-KMS",
  },
  {
    name: "logs-bucket",
    region: "us-east-1",
    created: "2023-02-01T00:00:00.000Z",
    sizeBytes: 0,
    objectCount: 0,
    versioningStatus: "Disabled",
    publicAccessBlocked: false,
    encryption: "none",
  },
];

const MOCK_S3_DETAIL = {
  bucket: "my-app-bucket",
  region: "ap-southeast-1",
  versioningStatus: "Enabled",
  publicAccessBlocked: true,
  publicAccessBlockConfig: null,
  encryption: "SSE-KMS",
  encryptionConfig: [],
  lifecycleRules: [],
  replicationRules: [],
  hasReplication: false,
  policy: null,
  policyRisk: false,
  corsRules: [],
  loggingTarget: null,
  loggingPrefix: null,
  tags: [],
  notificationLambdaFunctions: [],
  notificationSqsQueues: [],
  notificationSnsTopics: [],
  ownershipRule: null,
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("S3Section", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<S3Section />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders bucket rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: MOCK_BUCKETS, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-app-bucket")).toBeInTheDocument());
    expect(screen.getByText("logs-bucket")).toBeInTheDocument();
  });

  it("shows no buckets message when list is empty", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: [], fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No buckets found/i)).toBeInTheDocument());
  });

  it("shows public access warning when a bucket has public access", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: MOCK_BUCKETS, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/public access not fully blocked/i)).toBeInTheDocument());
  });

  it("navigates to bucket detail when row is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/s3/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_S3_DETAIL) });
      if (url.includes("/api/s3/objects")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ objects: [], commonPrefixes: [], nextContinuationToken: null, isTruncated: false, keyCount: 0 }) });
      if (url.includes("/api/s3")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ buckets: MOCK_BUCKETS, fetchedAt: new Date().toISOString() }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-app-bucket")).toBeInTheDocument());
    fireEvent.click(screen.getByText("my-app-bucket").closest("tr")!);

    // Should navigate to detail view and show Back button
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });

  it("sorts by column when header is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: MOCK_BUCKETS, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-app-bucket")).toBeInTheDocument());

    // Click the "Bucket Name" header to sort ascending (it's already sorted by name asc)
    fireEvent.click(screen.getByText("Bucket Name"));
    // Click again to sort descending
    fireEvent.click(screen.getByText("Bucket Name"));

    // Click Size header to sort by size
    fireEvent.click(screen.getByText("Size"));
    expect(screen.getAllByText("↑").length).toBeGreaterThan(0);
  });

  it("filters by bucket name with search input", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: MOCK_BUCKETS, fetchedAt: new Date().toISOString() } }));
    const { getByPlaceholderText } = renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-app-bucket")).toBeInTheDocument());

    fireEvent.change(getByPlaceholderText(/Filter by bucket name/i), { target: { value: "logs" } });

    await waitFor(() => {
      expect(screen.getByText("logs-bucket")).toBeInTheDocument();
    });
    expect(screen.queryByText("my-app-bucket")).toBeNull();
  });

  it("renders SSE-S3 and none encryption badges and unknown public access", async () => {
    const bucketsWithVariousEncryption = [
      { ...MOCK_BUCKETS[0], name: "sse-s3-bucket", encryption: "SSE-S3", publicAccessBlocked: null },
    ];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: bucketsWithVariousEncryption, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("sse-s3-bucket")).toBeInTheDocument());
    expect(screen.getByText("SSE-S3")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument(); // null publicAccessBlocked → "?"
  });

  it("renders none encryption badge with zero bytes", async () => {
    const bucketsAllZero = [
      { name: "empty-bucket", region: "ap-southeast-1", created: "", sizeBytes: 0, objectCount: 0, versioningStatus: "Disabled", publicAccessBlocked: false, encryption: "none" },
    ];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: bucketsAllZero, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("empty-bucket")).toBeInTheDocument());
    // The "none" encryption badge
    expect(screen.getByText("none")).toBeInTheDocument();
    // Total Size StatCard shows "—" for 0 bytes total (multiple "—" may appear)
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    // Public (Unlock icon shown)
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("shows plural 'buckets have' warning and descending sort covers remaining branches", async () => {
    const multiplePubBuckets = [
      { name: "pub-bucket-a", region: "us-east-1", created: "", sizeBytes: 200, objectCount: 10, versioningStatus: "", publicAccessBlocked: false, encryption: "SSE-KMS" },
      { name: "pub-bucket-b", region: "ap-southeast-1", created: "", sizeBytes: 100, objectCount: 5, versioningStatus: "", publicAccessBlocked: false, encryption: "SSE-KMS" },
    ];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/s3": { buckets: multiplePubBuckets, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<S3Section />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("pub-bucket-a")).toBeInTheDocument());
    // Multiple public buckets → "buckets have" (plural)
    expect(screen.getByText(/buckets have/i)).toBeInTheDocument();
    // Empty versioningStatus → "Disabled" via || operator
    expect(screen.getAllByText("Disabled").length).toBeGreaterThan(0);

    // Initial state already has "Bucket Name" sorted ascending (sortKey="name", sortAsc=true)
    // Click once to switch to descending
    fireEvent.click(screen.getByText("Bucket Name"));
    // After click, "↓" should appear (descending)
    await waitFor(() => expect(screen.getByText("↓")).toBeInTheDocument());
  });
});
