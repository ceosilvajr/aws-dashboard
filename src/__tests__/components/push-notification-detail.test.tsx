// src/__tests__/components/push-notification-detail.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { PushNotificationDetail } from "@/components/sections/push-notification-detail";

const DEFAULT_PROPS = {
  platformArn: "arn:aws:sns:ap-southeast-1:111:app/GCM/MyApp",
  platformName: "MyApp",
  platform: "GCM",
  profile: "proj-prod",
  onBack: vi.fn(),
};

const MOCK_DETAIL = {
  attributes: {
    Enabled: "true",
    SuccessFeedbackRoleArn: "arn:aws:iam::111:role/SNSFeedback",
  },
  endpoints: [
    { arn: "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/MyApp/abc", token: "abc…xyz", enabled: true },
    { arn: "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/MyApp/def", token: "def…uvw", enabled: false },
  ],
};

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("PushNotificationDetail", () => {
  it("shows loading state initially", () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });
    expect(screen.getByText(/Loading platform details/i)).toBeInTheDocument();
  });

  it("renders platform name and back button after load", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    expect(screen.getByText("MyApp")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} onBack={onBack} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders platform attributes", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Success Feedback Role")).toBeInTheDocument());
    expect(screen.getByText("arn:aws:iam::111:role/SNSFeedback")).toBeInTheDocument();
  });

  it("renders endpoint table with tokens", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": MOCK_DETAIL }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("abc…xyz")).toBeInTheDocument());
    expect(screen.getByText("def…uvw")).toBeInTheDocument();
  });

  it("shows error message when API returns error", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": { error: "ResourceNotFound" } }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("ResourceNotFound")).toBeInTheDocument());
  });

  it("shows empty endpoints message when no endpoints registered", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms/detail": { attributes: { Enabled: "true" }, endpoints: [] } }));
    renderWithProviders(<PushNotificationDetail {...DEFAULT_PROPS} />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No registered device endpoints/i)).toBeInTheDocument());
  });
});
