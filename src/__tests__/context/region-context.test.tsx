// src/__tests__/context/region-context.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RegionProvider, useRegion } from "@/context/region-context";

function TestConsumer() {
  const { region, regions, loading } = useRegion();
  if (loading) return <span data-testid="loading">loading</span>;
  return (
    <div>
      <span data-testid="region">{region}</span>
      <span data-testid="regions">{regions.join(",")}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          defaultRegion: "ap-southeast-1",
          regions: ["ap-southeast-1", "us-east-1"],
        }),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("RegionContext", () => {
  it("fetches config and sets default region", async () => {
    render(<RegionProvider><TestConsumer /></RegionProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("region").textContent).toBe("ap-southeast-1");
  });

  it("populates regions list from API response", async () => {
    render(<RegionProvider><TestConsumer /></RegionProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("regions").textContent).toBe("ap-southeast-1,us-east-1");
  });

  it("uses stored region from localStorage over default", async () => {
    localStorage.setItem("aws-dashboard-region", "eu-west-1");
    render(<RegionProvider><TestConsumer /></RegionProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("region").textContent).toBe("eu-west-1");
  });
});
