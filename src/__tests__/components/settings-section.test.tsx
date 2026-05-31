// src/__tests__/components/settings-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, render, fireEvent } from "@testing-library/react";
import { AccountsProvider } from "@/context/accounts-context";
import { RegionProvider } from "@/context/region-context";
import { SettingsSection } from "@/components/sections/settings-section";

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ theme: "system", setTheme: vi.fn() })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("SettingsSection", () => {
  it("renders the settings page with theme options", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1", "us-east-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: [], groups: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <AccountsProvider>
        <RegionProvider>
          <SettingsSection />
        </RegionProvider>
      </AccountsProvider>
    );

    await waitFor(() => expect(screen.getByText("Settings")).toBeInTheDocument());
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders AWS Region section", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1", "us-east-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: [], groups: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <AccountsProvider>
        <RegionProvider>
          <SettingsSection />
        </RegionProvider>
      </AccountsProvider>
    );

    await waitFor(() => expect(screen.getByText("AWS Region")).toBeInTheDocument());
  });

  it("renders Profile Groups and Deploy Defaults sections", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1", "us-east-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }], groups: ["proj"] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <AccountsProvider>
        <RegionProvider>
          <SettingsSection />
        </RegionProvider>
      </AccountsProvider>
    );

    await waitFor(() => expect(screen.getByText("Profile Groups")).toBeInTheDocument());
    expect(screen.getByText("Deploy Defaults")).toBeInTheDocument();

    // Group toggle should be visible
    await waitFor(() => expect(screen.getByText("proj")).toBeInTheDocument());
  });

  it("toggles a group when checkbox is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1", "us-east-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }], groups: ["proj"] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    localStorage.clear();

    render(
      <AccountsProvider>
        <RegionProvider>
          <SettingsSection />
        </RegionProvider>
      </AccountsProvider>
    );

    await waitFor(() => expect(screen.getByText("proj")).toBeInTheDocument());
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    // Should be unchecked now
    expect(checkbox).not.toBeChecked();
  });

  it("saves deploy defaults and shows Saved! message", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/profiles")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ accounts: [], groups: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));

    render(
      <AccountsProvider>
        <RegionProvider>
          <SettingsSection />
        </RegionProvider>
      </AccountsProvider>
    );

    await waitFor(() => expect(screen.getByText("Save Defaults")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Save Defaults"));
    await waitFor(() => expect(screen.getByText("Saved!")).toBeInTheDocument());
  });
});
