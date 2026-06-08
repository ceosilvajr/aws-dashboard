import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { SecureKeysSection } from "@/components/sections/secure-keys-section";

const DATA = {
  secrets: [{ name: "db/password", arn: "arn:1", description: "db", lastChangedDate: null, lastAccessedDate: null }],
  parameters: [{ name: "/app/key", type: "SecureString", lastModifiedDate: null, version: 3 }],
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("SecureKeysSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<SecureKeysSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders secrets in the default tab", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": DATA }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("db/password")).toBeInTheDocument());
  });

  it("switches to the parameters tab", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": DATA }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("db/password")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Parameter Store/i }));
    await waitFor(() => expect(screen.getByText("/app/key")).toBeInTheDocument());
  });

  it("drills into a secret detail when a row is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": DATA }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("db/password")).toBeInTheDocument());
    fireEvent.click(screen.getByText("db/password").closest("tr")!);
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });

  it("drills into a parameter detail when a parameter row is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": DATA }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("db/password")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Parameter Store/i }));
    await waitFor(() => expect(screen.getByText("/app/key")).toBeInTheDocument());
    fireEvent.click(screen.getByText("/app/key").closest("tr")!);
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });

  it("renders dates and tolerates a secret with empty arn and missing description", async () => {
    const data = {
      secrets: [{ name: "no-arn-secret", arn: "", description: "", lastChangedDate: "2024-03-03T00:00:00.000Z", lastAccessedDate: null }],
      parameters: [],
    };
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": data }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("no-arn-secret")).toBeInTheDocument());
    // formatted (non-null) last-changed date renders
    expect(screen.getByText(new Date("2024-03-03T00:00:00.000Z").toLocaleDateString())).toBeInTheDocument();
  });

  it("shows empty states for both tabs when there are no secrets or parameters", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": { secrets: [], parameters: [] } }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("No secrets found")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Parameter Store/i }));
    await waitFor(() => expect(screen.getByText("No parameters found")).toBeInTheDocument());
  });

  it("tolerates a response with no secrets/parameters keys", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/secure-keys": {} }));
    renderWithProviders(<SecureKeysSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText("No secrets found")).toBeInTheDocument());
  });
});
