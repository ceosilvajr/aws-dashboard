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

  it("navigates to dashboard section when Dashboard is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Dashboard"));
    expect(screen.getByTestId("active-section").textContent).toBe("dashboard");
  });

  it("navigates to ecs section when ECS Services is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("ECS Services")).toBeInTheDocument());
    fireEvent.click(screen.getByText("ECS Services"));
    expect(screen.getByTestId("active-section").textContent).toBe("ecs");
  });

  it("navigates to settings section when Settings is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Settings")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByTestId("active-section").textContent).toBe("settings");
  });

  it("navigates to cost-analysis section when Cost Analysis is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Cost Analysis")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Cost Analysis"));
    expect(screen.getByTestId("active-section").textContent).toBe("cost-analysis");
  });

  it("navigates to cognito section when Cognito is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Cognito")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Cognito"));
    expect(screen.getByTestId("active-section").textContent).toBe("cognito");
  });

  it("navigates to dynamodb section when DynamoDB is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("DynamoDB")).toBeInTheDocument());
    fireEvent.click(screen.getByText("DynamoDB"));
    expect(screen.getByTestId("active-section").textContent).toBe("dynamodb");
  });

  it("navigates to lambda section when Lambda is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Lambda")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Lambda"));
    expect(screen.getByTestId("active-section").textContent).toBe("lambda");
  });

  it("navigates to amplify section when Amplify is clicked", async () => {
    renderSidebar();
    await waitFor(() => expect(screen.getByText("Amplify")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Amplify"));
    expect(screen.getByTestId("active-section").textContent).toBe("amplify");
  });

  it("opens account dropdown when account button is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1", "us-east-1"] }) });
      return Promise.resolve({ json: () => Promise.resolve({ accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }], groups: ["proj"] }) });
    }));
    renderSidebar();

    await waitFor(() => expect(screen.getByText("All Accounts")).toBeInTheDocument());

    // Click the account button to open dropdown
    fireEvent.click(screen.getByText("All Accounts"));

    // The dropdown should be open now
    await waitFor(() => expect(screen.getByText("proj-prod")).toBeInTheDocument());
  });

  it("shows correct accounts in dropdown and selects one", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      return Promise.resolve({ json: () => Promise.resolve({ accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }], groups: ["proj"] }) });
    }));
    renderSidebar();

    await waitFor(() => expect(screen.getByText("All Accounts")).toBeInTheDocument());
    fireEvent.click(screen.getByText("All Accounts"));

    await waitFor(() => expect(screen.getByText("proj-prod")).toBeInTheDocument());
    fireEvent.click(screen.getByText("proj-prod"));

    // Dropdown should close after selection
    await waitFor(() => expect(screen.getByText("proj-prod")).toBeInTheDocument());
  });
});
