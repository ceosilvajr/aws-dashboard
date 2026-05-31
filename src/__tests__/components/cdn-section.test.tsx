// src/__tests__/components/cdn-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { CdnSection } from "@/components/sections/cdn-section";

const MOCK_DISTRIBUTIONS = [
  {
    id: "EABC123",
    domain: "abc123.cloudfront.net",
    aliases: ["www.example.com"],
    status: "Deployed",
    enabled: true,
    origins: ["my-bucket.s3.amazonaws.com"],
  },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("CdnSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<CdnSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders distributions when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cdn": { distributions: MOCK_DISTRIBUTIONS } }));
    renderWithProviders(<CdnSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("EABC123")).toBeInTheDocument());
    expect(screen.getByText("abc123.cloudfront.net")).toBeInTheDocument();
  });

  it("shows no distributions message when list is empty", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/cdn": { distributions: [] } }));
    renderWithProviders(<CdnSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No distributions found/i)).toBeInTheDocument());
  });
});
