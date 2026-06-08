import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SecureKeyDetail } from "@/components/sections/secure-key-detail";

afterEach(() => { vi.unstubAllGlobals(); });

describe("SecureKeyDetail", () => {
  it("loads and shows secret metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ kind: "secret", name: "db/password", arn: "arn:1", description: "db creds", rotationEnabled: true, lastChangedDate: null, lastAccessedDate: null, createdDate: null, tags: [] }),
    })));
    render(<SecureKeyDetail kind="secret" id="arn:1" name="db/password" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("db creds")).toBeInTheDocument());
    expect(screen.getByText(/Rotation/i)).toBeInTheDocument();
  });

  it("loads and shows parameter metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ kind: "parameter", name: "/app/key", type: "SecureString", version: 3, lastModifiedDate: null, description: "app key", tier: "Standard", dataType: "text" }),
    })));
    render(<SecureKeyDetail kind="parameter" name="/app/key" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("app key")).toBeInTheDocument());
    expect(screen.getByText("SecureString")).toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ kind: "secret", name: "n", arn: "a", description: "", rotationEnabled: false, lastChangedDate: null, lastAccessedDate: null, createdDate: null, tags: [] }) })));
    const onBack = vi.fn();
    render(<SecureKeyDetail kind="secret" id="a" name="n" profile="p" onBack={onBack} />);
    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows an error message when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));
    render(<SecureKeyDetail kind="secret" id="a" name="n" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Failed to load/i)).toBeInTheDocument());
  });

  it("shows an error message when the route returns an error payload", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "request failed" }) })));
    render(<SecureKeyDetail kind="parameter" name="/app/key" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Failed to load/i)).toBeInTheDocument());
  });

  it("renders formatted dates and tags for a secret", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        kind: "secret", name: "db/password", arn: "arn:1", description: "creds",
        rotationEnabled: false, lastChangedDate: "2024-01-02T00:00:00.000Z",
        lastAccessedDate: "2024-01-03T00:00:00.000Z", createdDate: "2024-01-01T00:00:00.000Z",
        tags: [{ key: "env", value: "prod" }],
      }),
    })));
    render(<SecureKeyDetail kind="secret" id="arn:1" name="db/password" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("creds")).toBeInTheDocument());
    expect(screen.getByText("env=prod")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText(new Date("2024-01-01T00:00:00.000Z").toLocaleString())).toBeInTheDocument();
  });

  it("falls back to name when a secret has no id, and renders em-dash for empty parameter fields", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ kind: "parameter", name: "/app/key", type: "String", version: 1, lastModifiedDate: null, description: "", tier: "", dataType: "" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    // kind=secret with no id triggers the `id ?? name` fallback in the request builder
    const { rerender } = render(<SecureKeyDetail kind="secret" name="fallback-name" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain("id=fallback-name");

    // parameter with empty description/tier/dataType renders em-dashes
    rerender(<SecureKeyDetail kind="parameter" name="/app/key" profile="p" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText("String")).toBeInTheDocument());
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
