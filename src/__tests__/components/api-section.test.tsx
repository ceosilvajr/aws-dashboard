// src/__tests__/components/api-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { ApiSection } from "@/components/sections/api-section";

afterEach(() => { vi.unstubAllGlobals(); });

describe("ApiSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<ApiSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders API stacks when data is loaded", async () => {
    const stacks = [{ name: "api-gateway-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", description: "REST API stack" }];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/security": { stacks } }));
    renderWithProviders(<ApiSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("api-gateway-stack")).toBeInTheDocument());
  });

  it("shows empty state when no stacks", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/security": { stacks: [] } }));
    renderWithProviders(<ApiSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("No API stacks found")).toBeInTheDocument());
  });
});
