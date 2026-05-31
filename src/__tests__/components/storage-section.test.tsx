// src/__tests__/components/storage-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { StorageSection } from "@/components/sections/storage-section";

afterEach(() => { vi.unstubAllGlobals(); });

describe("StorageSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<StorageSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders S3 buckets tab by default", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/storage?type=s3": { buckets: [{ name: "my-bucket", created: "2023-01-01T00:00:00.000Z" }] },
      "/api/storage?type=dynamodb": { tables: [] },
    }));
    renderWithProviders(<StorageSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-bucket")).toBeInTheDocument());
  });

  it("switches to DynamoDB tab when button is clicked", async () => {
    const mockTables = [{ name: "orders-table", status: "ACTIVE", itemCount: 1000, sizeBytes: 512, billingMode: "PAY_PER_REQUEST", created: "2023-01-01T00:00:00.000Z" }];
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/storage?type=s3": { buckets: [] },
      "/api/storage?type=dynamodb": { tables: mockTables },
    }));
    renderWithProviders(<StorageSection />, { profile: "proj-prod" });

    // "DynamoDB Tables" appears in both button and StatCard label - click the button
    fireEvent.click(screen.getAllByText("DynamoDB Tables")[0]);

    await waitFor(() => expect(screen.getByText("orders-table")).toBeInTheDocument());
  });

  it("shows bucket with empty created date (falsy branch) and DynamoDB non-ACTIVE status", async () => {
    const bucketNoDate = [{ name: "no-date-bucket", created: "" }];
    const tablesWithStatuses = [
      { name: "creating-table", status: "CREATING", itemCount: 0, sizeBytes: 0, billingMode: "PROVISIONED", created: "" },
    ];
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/storage?type=s3": { buckets: bucketNoDate },
      "/api/storage?type=dynamodb": { tables: tablesWithStatuses },
    }));
    renderWithProviders(<StorageSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("no-date-bucket")).toBeInTheDocument());

    // Switch to DynamoDB to see non-ACTIVE status
    fireEvent.click(screen.getAllByText("DynamoDB Tables")[0]);
    await waitFor(() => expect(screen.getByText("creating-table")).toBeInTheDocument());
    expect(screen.getByText("CREATING")).toBeInTheDocument(); // non-ACTIVE → secondary variant
  });

  it("shows empty DynamoDB tables message", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/storage?type=s3": { buckets: [{ name: "b", created: "" }] },
      "/api/storage?type=dynamodb": { tables: [] },
    }));
    renderWithProviders(<StorageSection />, { profile: "proj-prod" });

    fireEvent.click(screen.getAllByText("DynamoDB Tables")[0]);
    await waitFor(() => expect(screen.getByText(/No tables found/i)).toBeInTheDocument());
  });
});
