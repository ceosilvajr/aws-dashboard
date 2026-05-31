// src/__tests__/components/push-notifications-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { PushNotificationsSection } from "@/components/sections/push-notifications-section";

const MOCK_PLATFORMS = [
  {
    account: "proj-prod", accountId: "111", profile: "proj-prod",
    arn: "arn:aws:sns:ap-southeast-1:111:app/GCM/MyAndroidApp",
    name: "MyAndroidApp", platform: "GCM", enabled: true, attributes: {},
  },
  {
    account: "proj-prod", accountId: "111", profile: "proj-prod",
    arn: "arn:aws:sns:ap-southeast-1:111:app/APNS/MyiOSApp",
    name: "MyiOSApp", platform: "APNS", enabled: false, attributes: {},
  },
];

afterEach(() => { vi.unstubAllGlobals(); });

describe("PushNotificationsSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<PushNotificationsSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders platform rows when data is loaded", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: MOCK_PLATFORMS } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyAndroidApp")).toBeInTheDocument());
    expect(screen.getByText("MyiOSApp")).toBeInTheDocument();
  });

  it("shows Android (FCM) badge for GCM platform", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [MOCK_PLATFORMS[0]] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Android (FCM)")).toBeInTheDocument());
  });

  it("shows iOS (APNS) badge for APNS platform", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [MOCK_PLATFORMS[1]] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("iOS (APNS)")).toBeInTheDocument());
  });

  it("shows empty state when no platforms found", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/sns-platforms": { platforms: [] } }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText(/No SNS platform applications found/i)).toBeInTheDocument());
  });

  it("navigates to detail view when a row is clicked", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/sns-platforms/detail": { attributes: { Enabled: "true" }, endpoints: [] },
      "/api/sns-platforms": { platforms: [MOCK_PLATFORMS[0]] },
    }));
    renderWithProviders(<PushNotificationsSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("MyAndroidApp")).toBeInTheDocument());
    fireEvent.click(screen.getByText("MyAndroidApp").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
  });
});
