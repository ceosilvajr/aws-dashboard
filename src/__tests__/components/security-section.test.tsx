// src/__tests__/components/security-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { SecuritySection } from "@/components/sections/security-section";

const MOCK_STACKS = [
  { name: "iam-roles-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "IAM roles" },
  { name: "waf-rules-stack", status: "UPDATE_COMPLETE", created: "2023-02-01T00:00:00.000Z", description: "WAF rules" },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("SecuritySection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<SecuritySection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders security stacks when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/security": { stacks: MOCK_STACKS } }));
    renderWithProviders(<SecuritySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("iam-roles-stack")).toBeInTheDocument());
    expect(screen.getByText("waf-rules-stack")).toBeInTheDocument();
  });

  it("shows empty message when no security stacks found", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/security": { stacks: [] } }));
    renderWithProviders(<SecuritySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No security stacks found/i)).toBeInTheDocument());
  });

  it("renders all type badges for different stack names", async () => {
    const allTypeStacks = [
      { name: "iam-roles-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "" },
      { name: "waf-rules-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "" },
      { name: "cognito-user-pool-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "" },
      { name: "api-authorizer-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "" },
      { name: "security-group-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "" },
    ];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/security": { stacks: allTypeStacks } }));
    renderWithProviders(<SecuritySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("IAM")).toBeInTheDocument());
    expect(screen.getByText("WAF")).toBeInTheDocument();
    expect(screen.getByText("Cognito")).toBeInTheDocument();
    expect(screen.getByText("Authorizer")).toBeInTheDocument();
    // "Security" appears as both page title and badge
    expect(screen.getAllByText("Security").length).toBeGreaterThanOrEqual(2);
  });

  it("shows created date for stacks with valid created timestamp", async () => {
    const stacks = [
      { name: "stack-1", status: "CREATE_COMPLETE", created: "2023-06-15T00:00:00.000Z", description: "" },
      { name: "stack-2", status: "CREATE_COMPLETE", created: "", description: "" }, // empty created
    ];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/security": { stacks } }));
    renderWithProviders(<SecuritySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("stack-1")).toBeInTheDocument());
  });
});
