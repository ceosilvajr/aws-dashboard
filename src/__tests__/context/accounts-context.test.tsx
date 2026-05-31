// src/__tests__/context/accounts-context.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AccountsProvider, useAccounts } from "@/context/accounts-context";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
  { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
  { id: "333", name: "other-prod", profile: "other-prod", group: "other" },
];

function TestConsumer() {
  const { accounts, groups, loading } = useAccounts();
  if (loading) return <span data-testid="loading">loading</span>;
  return (
    <div>
      <span data-testid="count">{accounts.length}</span>
      <span data-testid="groups">{groups.join(",")}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({ accounts: MOCK_ACCOUNTS, groups: ["proj", "other"] }),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AccountsContext", () => {
  it("fetches accounts and exposes all by default", async () => {
    render(<AccountsProvider><TestConsumer /></AccountsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("exposes discovered groups", async () => {
    render(<AccountsProvider><TestConsumer /></AccountsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("groups").textContent).toBe("proj,other");
  });

  it("filters accounts to stored enabled groups from localStorage", async () => {
    localStorage.setItem("aws-dashboard-enabled-groups", JSON.stringify(["other"]));
    render(<AccountsProvider><TestConsumer /></AccountsProvider>);
    await waitFor(() => expect(screen.queryByTestId("loading")).toBeNull());
    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
