// src/__tests__/components/dynamodb-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { DynamoDbSection } from "@/components/sections/dynamodb-section";

const MOCK_TABLES = [
  {
    account: "proj-prod",
    accountId: "111",
    profile: "proj-prod",
    tableName: "users-table",
    status: "ACTIVE",
    deletionProtection: true,
    sizeBytes: 1024 * 1024,
    itemCount: 5000,
  },
];

const MOCK_TABLE_DETAIL = {
  pk: "userId",
  sk: "createdAt",
  indexes: [
    { name: "email-index", type: "GSI", keys: "email (PK)", projection: "ALL", status: "ACTIVE" },
  ],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("DynamoDbSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<DynamoDbSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders table rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/dynamodb": { tables: MOCK_TABLES, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<DynamoDbSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("users-table")).toBeInTheDocument());
  });

  it("expands table detail when row is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/dynamodb/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_TABLE_DETAIL) });
      if (url.includes("/api/dynamodb")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ tables: MOCK_TABLES, fetchedAt: new Date().toISOString() }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<DynamoDbSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("users-table")).toBeInTheDocument());
    fireEvent.click(screen.getByText("users-table").closest("tr")!);

    await waitFor(() => expect(screen.getByText("userId")).toBeInTheDocument());
    expect(screen.getByText("email-index")).toBeInTheDocument();
  });
});
