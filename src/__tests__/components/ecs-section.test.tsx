// src/__tests__/components/ecs-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { EcsSection } from "@/components/sections/ecs-section";

const MOCK_SERVICES = [
  {
    account: "proj-prod",
    accountId: "111",
    cluster: "my-cluster",
    service: "my-service",
    container: "app",
    image: "my-repo",
    tag: "v1.0.0",
    cpu: "256",
    memory: "512",
    port: 8080,
    desired: 2,
    running: 2,
    minCapacity: 1,
    maxCapacity: 4,
    status: "healthy",
    targetGroups: [],
  },
];

const MOCK_ECS_DETAIL = {
  service: "my-service",
  cluster: "my-cluster",
  cpu: "256",
  memory: "512",
  desiredCount: 2,
  runningCount: 2,
  envVars: [{ name: "APP_ENV", value: "production" }],
};

const MOCK_SCALING = {
  resourceId: "service/my-cluster/my-service",
  minCapacity: 1,
  maxCapacity: 10,
  suspendedState: { DynamicScalingInSuspended: true, DynamicScalingOutSuspended: false },
  policies: [{
    name: "cpu-policy",
    type: "TargetTrackingScaling",
    metric: "ECSServiceAverageCPUUtilization",
    targetValue: 70,
    scaleInCooldown: 300,
    scaleOutCooldown: 60,
    stepAdjustments: [],
  }],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("EcsSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<EcsSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders service rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/ecs": { services: MOCK_SERVICES, fetchedAt: new Date().toISOString() } }));
    renderWithProviders(<EcsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-service")).toBeInTheDocument());
    // Cluster name appears in "Cluster: my-cluster" badge
    expect(screen.getByText(/my-cluster/i)).toBeInTheDocument();
  });

  it("navigates to detail view when a service row is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/ecs/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ECS_DETAIL) });
      if (url.includes("/api/ecs/scaling")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "not found" }) });
      if (url.includes("/api/ecs")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ services: MOCK_SERVICES, fetchedAt: new Date().toISOString() }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<EcsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-service")).toBeInTheDocument());
    fireEvent.click(screen.getByText("my-service").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    expect(screen.getByText("APP_ENV")).toBeInTheDocument();
  });

  it("shows scaling panel with policies and suspended state in detail view", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/ecs/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_ECS_DETAIL) });
      if (url.includes("/api/ecs/scaling")) return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_SCALING) });
      if (url.includes("/api/ecs")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ services: MOCK_SERVICES, fetchedAt: new Date().toISOString() }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<EcsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-service")).toBeInTheDocument());
    fireEvent.click(screen.getByText("my-service").closest("tr")!);

    await waitFor(() => expect(screen.getByText("cpu-policy")).toBeInTheDocument());
    expect(screen.getByText("ECSServiceAverageCPUUtilization")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
