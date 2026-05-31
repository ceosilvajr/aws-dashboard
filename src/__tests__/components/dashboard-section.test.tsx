// src/__tests__/components/dashboard-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@testing-library/react";
import { ProfileProvider } from "@/context/profile-context";
import { NavProvider } from "@/context/nav-context";
import { RegionProvider, useRegion } from "@/context/region-context";
import { AccountsProvider } from "@/context/accounts-context";
import { useEffect, ReactNode } from "react";
import { useProfile } from "@/context/profile-context";
import { DashboardSection } from "@/components/sections/dashboard-section";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function ProfileSetter({ profile }: { profile: string | null }) {
  const { setProfile } = useProfile();
  useEffect(() => { setProfile(profile); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function RegionSetter({ region }: { region: string }) {
  const { setRegion } = useRegion();
  useEffect(() => { setRegion(region); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function renderWithAllProviders(ui: ReactNode, { profile = "proj-prod" } = {}) {
  return render(
    <AccountsProvider>
      <ProfileProvider>
        <ProfileSetter profile={profile} />
        <NavProvider>
          <RegionProvider>
            <RegionSetter region="ap-southeast-1" />
            {ui}
          </RegionProvider>
        </NavProvider>
      </ProfileProvider>
    </AccountsProvider>
  );
}

describe("DashboardSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: [], groups: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithAllProviders(<DashboardSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders dashboard with overview data", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }],
        groups: ["proj"],
      }) });
      if (url.includes("/api/overview")) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        account: "proj-prod",
        s3Buckets: 5,
        dynamoTables: 3,
        ecrRepos: 2,
        cloudFrontDistributions: 1,
        lambdaFunctions: 10,
        cfnStacks: 4,
        monthlyCost: "150.00",
        forecastedCost: null,
        topServices: null,
        fetchedAt: new Date().toISOString(),
      }) });
      if (url.includes("/api/ecs")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ services: [], fetchedAt: new Date().toISOString() }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithAllProviders(<DashboardSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  });

  it("renders top services and unhealthy services alert", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }],
        groups: ["proj"],
      }) });
      if (url.includes("/api/overview")) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        account: "proj-prod",
        s3Buckets: 5,
        dynamoTables: 3,
        ecrRepos: 2,
        cloudFrontDistributions: 1,
        lambdaFunctions: 10,
        cfnStacks: 4,
        monthlyCost: "200.00",
        forecastedCost: "250.00",
        topServices: [
          { name: "Amazon EC2", cost: "150.00" },
          { name: "Amazon S3", cost: "50.00" },
        ],
        fetchedAt: new Date().toISOString(),
      }) });
      if (url.includes("/api/ecs")) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        services: [
          { service: "my-service", status: "unhealthy", running: 1, desired: 3, cluster: "my-cluster", account: "proj-prod" },
        ],
        fetchedAt: new Date().toISOString(),
      }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithAllProviders(<DashboardSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Amazon EC2")).toBeInTheDocument());
    expect(screen.getByText("Amazon S3")).toBeInTheDocument();
    // Unhealthy services section should appear
    await waitFor(() => expect(screen.getByText("my-service")).toBeInTheDocument());
  });
});
