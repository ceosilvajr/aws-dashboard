// src/__tests__/components/accounts-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import { AccountsSection } from "@/components/sections/accounts-section";
import { AccountsProvider } from "@/context/accounts-context";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AccountsSection", () => {
  it("renders account cards when accounts are loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        accounts: [
          { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
          { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
        ],
        groups: ["proj"],
      }),
    }));

    render(
      <AccountsProvider>
        <AccountsSection />
      </AccountsProvider>
    );

    // profile appears both as name and in badge, so use getAllByText
    await waitFor(() => expect(screen.getAllByText("proj-prod").length).toBeGreaterThan(0));
    expect(screen.getAllByText("proj-dev").length).toBeGreaterThan(0);
    expect(screen.getByText("111")).toBeInTheDocument();
  });

  it("renders empty state when no accounts loaded yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ accounts: [], groups: [] }),
    }));

    render(
      <AccountsProvider>
        <AccountsSection />
      </AccountsProvider>
    );

    await waitFor(() => expect(screen.getByText("Accounts")).toBeInTheDocument());
    // No account names should appear
    expect(screen.queryByText("proj-prod")).toBeNull();
  });
});
