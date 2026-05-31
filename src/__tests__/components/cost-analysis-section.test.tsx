// src/__tests__/components/cost-analysis-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { CostAnalysisSection } from "@/components/sections/cost-analysis-section";

const MOCK_COST_DATA = {
  totalRunningCost: "155.75",
  forecastedCost: "200.00",
  daysElapsed: 15,
  daysInMonth: 31,
  services: [
    { name: "Amazon EC2", runningCost: "100.00", projectedCost: "200.00", dailyRate: "6.67" },
    { name: "Amazon S3", runningCost: "5.75", projectedCost: "11.50", dailyRate: "0.38" },
  ],
  suggestions: [
    { service: "Amazon EC2", suggestion: "Use Reserved Instances", impact: "Up to 72% savings" },
  ],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("CostAnalysisSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<CostAnalysisSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders cost data when loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cost-analysis": MOCK_COST_DATA }));
    renderWithProviders(<CostAnalysisSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("$155.75")).toBeInTheDocument());
    // $200.00 appears in both forecast card and projected cost column — just check it's rendered
    expect(screen.getAllByText("$200.00").length).toBeGreaterThan(0);
  });

  it("renders service breakdown table", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cost-analysis": MOCK_COST_DATA }));
    renderWithProviders(<CostAnalysisSection />, { profile: "proj-prod" });

    // "Amazon EC2" appears in both table row and suggestions — use getAllByText
    await waitFor(() => expect(screen.getAllByText("Amazon EC2").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Amazon S3").length).toBeGreaterThan(0);
  });
});
