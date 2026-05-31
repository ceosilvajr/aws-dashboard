// src/__tests__/components/cognito-pool-detail.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { render } from "@testing-library/react";
import { CognitoPoolDetail } from "@/components/sections/cognito-pool-detail";

afterEach(() => { vi.unstubAllGlobals(); });

const DEFAULT_PROPS = {
  poolId: "ap-southeast-1_abc123",
  poolName: "MyPool",
  profile: "proj-prod",
  onBack: vi.fn(),
};

const MOCK_COUNTS = {
  CONFIRMED: 500,
  UNCONFIRMED: 10,
  ARCHIVED: 5,
  COMPROMISED: 1,
  UNKNOWN: 2,
  RESET_REQUIRED: 3,
  FORCE_CHANGE_PASSWORD: 8,
  total: 529,
};

describe("CognitoPoolDetail", () => {
  it("renders the pool detail with pool name and ID", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(MOCK_COUNTS) }));
    render(<CognitoPoolDetail {...DEFAULT_PROPS} />);
    expect(screen.getByText("MyPool")).toBeInTheDocument();
    expect(screen.getByText("ap-southeast-1_abc123")).toBeInTheDocument();
  });

  it("calls onBack when Back button is clicked", () => {
    const onBack = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(MOCK_COUNTS) }));
    render(<CognitoPoolDetail {...DEFAULT_PROPS} onBack={onBack} />);
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalled();
  });

  it("fetches and displays counts when Run is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(MOCK_COUNTS) }));
    render(<CognitoPoolDetail {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByText("Run"));

    await waitFor(() => expect(screen.getByText("529")).toBeInTheDocument());
    // Should show Confirmed count
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("shows custom range inputs when Custom Range is selected", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(MOCK_COUNTS) }));
    render(<CognitoPoolDetail {...DEFAULT_PROPS} />);

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "custom" } });

    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
  });

  it("shows End of Month selectors when eom is selected", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(MOCK_COUNTS) }));
    render(<CognitoPoolDetail {...DEFAULT_PROPS} />);

    const select = screen.getAllByRole("combobox")[0];
    fireEvent.change(select, { target: { value: "eom" } });

    expect(screen.getByText("Month")).toBeInTheDocument();
    expect(screen.getByText("Year")).toBeInTheDocument();
  });

  it("shows Last 24h filter option", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve(MOCK_COUNTS) }));
    render(<CognitoPoolDetail {...DEFAULT_PROPS} />);

    const select = screen.getAllByRole("combobox")[0];
    fireEvent.change(select, { target: { value: "24h" } });

    // No custom fields visible but 24h is selected
    expect(screen.queryByLabelText(/Start/i)).toBeNull();
  });
});
