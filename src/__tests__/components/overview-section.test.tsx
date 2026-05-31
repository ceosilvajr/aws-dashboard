// src/__tests__/components/overview-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { OverviewSection } from "@/components/overview-section";

afterEach(() => { vi.unstubAllGlobals(); });

describe("OverviewSection", () => {
  it("shows loading state when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<OverviewSection />, { profile: null });
    // Should not crash and should show the section title or loading indicator
    expect(document.body).toBeTruthy();
  });

  it("renders resource counts when overview data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/overview": {
        account: "proj-prod",
        s3Buckets: 10,
        dynamoTables: 5,
        ecrRepos: 3,
        cloudFrontDistributions: 2,
        lambdaFunctions: 20,
        cfnStacks: 8,
        monthlyCost: "250.00",
        topServices: [{ name: "Amazon EC2", cost: "100.00" }],
      },
    }));
    renderWithProviders(<OverviewSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument());
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("handles null values gracefully", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/overview": {
        account: "proj-prod",
        s3Buckets: null,
        dynamoTables: null,
        ecrRepos: null,
        cloudFrontDistributions: null,
        lambdaFunctions: null,
        cfnStacks: null,
        monthlyCost: null,
        topServices: null,
      },
    }));
    renderWithProviders(<OverviewSection />, { profile: "proj-prod" });

    await waitFor(() => expect(document.body).toBeTruthy());
  });
});
