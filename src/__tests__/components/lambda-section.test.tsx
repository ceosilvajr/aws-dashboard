// src/__tests__/components/lambda-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { LambdaSection } from "@/components/sections/lambda-section";

const MOCK_FUNCTIONS = [
  {
    name: "my-function",
    runtime: "nodejs18.x",
    memory: 128,
    timeout: 30,
    lastModified: "2024-01-01T00:00:00.000+0000",
    state: "Active",
  },
];

const MOCK_LAMBDA_DETAIL = {
  name: "my-function",
  arn: "arn:aws:lambda:ap-southeast-1:111:function:my-function",
  runtime: "nodejs18.x",
  handler: "index.handler",
  role: "arn:aws:iam::111:role/lambda-role",
  codeSize: 1024,
  description: "My function",
  lastModified: "2024-01-01T00:00:00.000+0000",
  state: "Active",
  stateReason: "",
  lastUpdateStatus: "Successful",
  lastUpdateReason: "",
  memorySize: 128,
  timeout: 30,
  ephemeralStorage: 512,
  reservedConcurrency: null,
  vpcId: "",
  subnetIds: [],
  securityGroupIds: [],
  envVarCount: 2,
  layers: [],
  architectures: ["x86_64"],
  eventSources: [],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("LambdaSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<LambdaSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders function rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/lambda": { functions: MOCK_FUNCTIONS } }));
    renderWithProviders(<LambdaSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-function")).toBeInTheDocument());
    expect(screen.getByText("nodejs18.x")).toBeInTheDocument();
  });

  it("shows empty message when no functions", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/lambda": { functions: [] } }));
    renderWithProviders(<LambdaSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("No Lambda functions found")).toBeInTheDocument());
  });

  it("navigates to detail view when a function row is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/lambda/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_LAMBDA_DETAIL) });
      if (url.includes("/api/lambda")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ functions: MOCK_FUNCTIONS }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<LambdaSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-function")).toBeInTheDocument());
    fireEvent.click(screen.getByText("my-function").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    // Detail shows handler info
    await waitFor(() => expect(screen.getByText("index.handler")).toBeInTheDocument());
  });
});
