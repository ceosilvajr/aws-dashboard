// src/__tests__/components/amplify-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { AmplifySection } from "@/components/sections/amplify-section";

const MOCK_APPS = [
  {
    appId: "app1",
    name: "My App",
    platform: "WEB",
    repository: "https://github.com/org/repo",
    defaultDomain: "main.abc123.amplifyapp.com",
    updateTime: "2024-01-01T00:00:00.000Z",
  },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("AmplifySection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<AmplifySection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders app rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/amplify": { apps: MOCK_APPS } }));
    renderWithProviders(<AmplifySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("My App")).toBeInTheDocument());
    expect(screen.getByText("WEB")).toBeInTheDocument();
  });

  it("shows no apps message when list is empty", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/amplify": { apps: [] } }));
    renderWithProviders(<AmplifySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No Amplify apps found/i)).toBeInTheDocument());
  });

  it("navigates to detail view when an app row is clicked", async () => {
    const fetchMock = makeConfigFetch({ "/api/amplify": { apps: MOCK_APPS } });
    // Also handle detail fetches
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      }
      if (url.includes("/api/amplify/detail")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            appId: "app1",
            name: "My App",
            platform: "WEB",
            repository: "https://github.com/org/repo",
            defaultDomain: "main.abc123.amplifyapp.com",
            createTime: "2023-01-01T00:00:00.000Z",
            updateTime: "2024-01-01T00:00:00.000Z",
            domains: [],
            branches: [],
            envVars: [],
          }),
        });
      }
      if (url.includes("/api/amplify")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ apps: MOCK_APPS }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<AmplifySection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("My App")).toBeInTheDocument());
    fireEvent.click(screen.getByText("My App").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });
});
