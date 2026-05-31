// src/__tests__/components/sidebar.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Sidebar } from "@/components/sidebar";
import { ProfileProvider } from "@/context/profile-context";
import { NavProvider, useNav } from "@/context/nav-context";
import { RegionProvider } from "@/context/region-context";
import { AccountsProvider } from "@/context/accounts-context";

function SidebarWithNav() {
  const { section } = useNav();
  return (
    <>
      <Sidebar />
      <span data-testid="active-section">{section}</span>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.includes("/api/config")) {
      return Promise.resolve({ json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ accounts: [], groups: [] }) });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSidebar() {
  return render(
    <ProfileProvider>
      <NavProvider>
        <RegionProvider>
          <AccountsProvider>
            <SidebarWithNav />
          </AccountsProvider>
        </RegionProvider>
      </NavProvider>
    </ProfileProvider>
  );
}

describe("Sidebar", () => {
  it("renders Push Notifications nav item", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
  });

  it("renders Cognito nav item", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Cognito")).toBeInTheDocument());
  });

  it("navigates to s3 section when S3 Buckets is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("S3 Buckets")).toBeInTheDocument());
    fireEvent.click(screen.getByText("S3 Buckets"));
    expect(screen.getByTestId("active-section").textContent).toBe("s3");
  });

  it("navigates to push-notifications section when Push Notifications is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Push Notifications"));
    expect(screen.getByTestId("active-section").textContent).toBe("push-notifications");
  });

  it("collapses sidebar and hides labels when toggle button is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Collapse"));
    expect(screen.queryByText("Push Notifications")).toBeNull();
  });

  it("expands sidebar and shows labels when expand button is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Push Notifications")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("Collapse"));
    expect(screen.queryByText("Push Notifications")).toBeNull();
    fireEvent.click(screen.getByTitle("Expand"));
    expect(screen.getByText("Push Notifications")).toBeInTheDocument();
  });
});
