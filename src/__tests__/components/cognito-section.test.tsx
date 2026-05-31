// src/__tests__/components/cognito-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { CognitoSection } from "@/components/sections/cognito-section";

const MOCK_POOLS = [
  { account: "proj-prod", accountId: "111", profile: "proj-prod", poolId: "ap-southeast-1_abc", poolName: "MyPool", estimatedUsers: 100 },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("CognitoSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<CognitoSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders user pool rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cognito": { pools: MOCK_POOLS } }));
    renderWithProviders(<CognitoSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyPool")).toBeInTheDocument());
    expect(screen.getByText("ap-southeast-1_abc")).toBeInTheDocument();
  });

  it("navigates to detail view when a pool row is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cognito": { pools: MOCK_POOLS } }));
    renderWithProviders(<CognitoSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyPool")).toBeInTheDocument());
    fireEvent.click(screen.getByText("MyPool").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });
});
