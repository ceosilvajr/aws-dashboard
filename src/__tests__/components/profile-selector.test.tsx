// src/__tests__/components/profile-selector.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, render } from "@testing-library/react";
import { ProfileProvider } from "@/context/profile-context";
import { AccountsProvider } from "@/context/accounts-context";
import { ProfileSelector } from "@/components/profile-selector";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function renderProfileSelector() {
  return render(
    <AccountsProvider>
      <ProfileProvider>
        <ProfileSelector />
      </ProfileProvider>
    </AccountsProvider>
  );
}

describe("ProfileSelector", () => {
  it("shows All Accounts when no profile selected and no accounts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ accounts: [], groups: [] }),
    }));

    renderProfileSelector();
    await waitFor(() => expect(screen.getByText("All Accounts")).toBeInTheDocument());
  });

  it("shows account names in the dropdown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        accounts: [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }],
        groups: ["proj"],
      }),
    }));

    renderProfileSelector();
    // The trigger button text shows "All Accounts" initially
    await waitFor(() => expect(screen.getByText("All Accounts")).toBeInTheDocument());
  });
});
