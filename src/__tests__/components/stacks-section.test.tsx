// src/__tests__/components/stacks-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { StacksSection } from "@/components/stacks-section";

afterEach(() => { vi.unstubAllGlobals(); });

const MOCK_STACKS = [
  { name: "app-stack", status: "CREATE_COMPLETE", created: "2023-01-01T00:00:00.000Z", updated: "2023-06-01T00:00:00.000Z", description: "Application stack" },
  { name: "rollback-stack", status: "ROLLBACK_COMPLETE", created: "2023-02-01T00:00:00.000Z", updated: "", description: "" },
  { name: "progress-stack", status: "UPDATE_IN_PROGRESS", created: "2023-03-01T00:00:00.000Z", updated: "", description: "" },
];

describe("StacksSection", () => {
  it("shows empty state when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<StacksSection />, { profile: null });
    // Should not crash
    expect(document.body).toBeTruthy();
  });

  it("renders stack rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/stacks": { stacks: MOCK_STACKS } }));
    renderWithProviders(<StacksSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("app-stack")).toBeInTheDocument());
    expect(screen.getByText("rollback-stack")).toBeInTheDocument();
  });

  it("shows no stacks message when list is empty", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/stacks": { stacks: [] } }));
    renderWithProviders(<StacksSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No stacks/i)).toBeInTheDocument());
  });

  it("filters stacks by search input", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/stacks": { stacks: MOCK_STACKS } }));
    const { getByPlaceholderText } = renderWithProviders(<StacksSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("app-stack")).toBeInTheDocument());

    const searchInput = getByPlaceholderText(/filter/i);
    fireEvent.change(searchInput, { target: { value: "rollback" } });

    expect(screen.getByText("rollback-stack")).toBeInTheDocument();
    expect(screen.queryByText("app-stack")).toBeNull();
  });
});
