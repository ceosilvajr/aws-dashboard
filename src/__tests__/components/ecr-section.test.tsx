// src/__tests__/components/ecr-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { EcrSection } from "@/components/sections/ecr-section";

const MOCK_REPOS = [
  {
    name: "my-app",
    uri: "111.dkr.ecr.ap-southeast-1.amazonaws.com/my-app",
    created: "2023-01-01T00:00:00.000Z",
    scanOnPush: true,
    tagMutability: "IMMUTABLE",
    latestTag: "v1.0.0",
    latestPushed: "2024-01-01T00:00:00.000Z",
    imageCount: 5,
    sizeMB: 200,
  },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("EcrSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<EcrSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders repositories when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/ecr": { repositories: MOCK_REPOS } }));
    renderWithProviders(<EcrSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-app")).toBeInTheDocument());
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("shows empty message when no repos", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/ecr": { repositories: [] } }));
    renderWithProviders(<EcrSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No repositories found/i)).toBeInTheDocument());
  });

  it("shows 'no images' when repo has no latestTag, and 'Disabled' when scanOnPush is false", async () => {
    const repos = [{
      name: "empty-repo",
      uri: "111.dkr.ecr.ap-southeast-1.amazonaws.com/empty-repo",
      created: "2023-01-01T00:00:00.000Z",
      scanOnPush: false, // Disabled
      tagMutability: "MUTABLE", // secondary variant
      latestTag: "", // no images
      latestPushed: "", // no date
      imageCount: 0,
      sizeMB: 0,
    }];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/ecr": { repositories: repos } }));
    renderWithProviders(<EcrSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("no images")).toBeInTheDocument());
    expect(screen.getByText("—")).toBeInTheDocument(); // no latestPushed
    expect(screen.getByText("Disabled")).toBeInTheDocument(); // scanOnPush false
  });

  it("filters repositories by search input and shows 'No repositories match filter' message", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/ecr": { repositories: MOCK_REPOS } }));
    const { getByPlaceholderText } = renderWithProviders(<EcrSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-app")).toBeInTheDocument());

    fireEvent.change(getByPlaceholderText(/Filter repositories/i), { target: { value: "nonexistent" } });

    await waitFor(() => expect(screen.getByText(/No repositories match filter/i)).toBeInTheDocument());
  });
});
