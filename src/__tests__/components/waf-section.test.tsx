// src/__tests__/components/waf-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { WafSection } from "@/components/sections/waf-section";

const LIST = { acls: [{ id: "acl-1", name: "prod-waf", arn: "arn:waf:1" }] };
const DETAIL = {
  name: "prod-waf",
  arn: "arn:waf:1",
  capacity: 700,
  defaultAction: "Allow",
  rules: [
    { name: "AWSManagedRulesCommonRuleSet", priority: 1, action: "override", type: "Managed: AWS/AWSManagedRulesCommonRuleSet", category: "managed", status: "enabled", managedRuleName: "AWSManagedRulesCommonRuleSet" },
    { name: "OldRule", priority: 2, action: "none", type: "Custom", category: "custom", status: "disabled" },
  ],
  managedRules: [
    { name: "AWSManagedRulesCommonRuleSet", priority: 1, action: "override", type: "Managed: AWS/AWSManagedRulesCommonRuleSet", category: "managed", status: "enabled", managedRuleName: "AWSManagedRulesCommonRuleSet" },
  ],
  customRules: [
    { name: "OldRule", priority: 2, action: "none", type: "Custom", category: "custom", status: "disabled" },
  ],
  recommendations: [
    { name: "AWSManagedRulesSQLiRuleSet", vendor: "AWS", description: "Blocks SQL injection." },
  ],
  associatedResources: [],
};

// /api/waf/detail must be registered BEFORE /api/waf so substring matching picks it first.
const wafFetch = () => makeConfigFetch({ "/api/waf/detail": DETAIL, "/api/waf": LIST });

afterEach(() => { vi.unstubAllGlobals(); });

describe("WafSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<WafSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("lists WebACLs", async () => {
    vi.stubGlobal("fetch", wafFetch());
    renderWithProviders(<WafSection />, { profile: "proj-prod" });
    expect(await screen.findByText("prod-waf")).toBeInTheDocument();
  });

  it("shows empty state when no WebACLs", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/waf": { acls: [] } }));
    renderWithProviders(<WafSection />, { profile: "proj-prod" });
    await waitFor(() => expect(screen.getByText(/No Web ACLs found/i)).toBeInTheDocument());
  });

  it("expands a WebACL and shows active, disabled, and recommended rules", async () => {
    vi.stubGlobal("fetch", wafFetch());
    renderWithProviders(<WafSection />, { profile: "proj-prod" });
    const acl = await screen.findByText("prod-waf");
    fireEvent.click(acl);
    await waitFor(() => expect(screen.getByText("AWSManagedRulesCommonRuleSet")).toBeInTheDocument());
    expect(screen.getByText("OldRule")).toBeInTheDocument();
    expect(screen.getByText("AWSManagedRulesSQLiRuleSet")).toBeInTheDocument();
    expect(screen.getByText(/Blocks SQL injection/i)).toBeInTheDocument();
  });

  it("collapses an expanded WebACL when clicked again", async () => {
    vi.stubGlobal("fetch", wafFetch());
    renderWithProviders(<WafSection />, { profile: "proj-prod" });
    const acl = await screen.findByText("prod-waf");
    fireEvent.click(acl);
    await waitFor(() => expect(screen.getByText("AWSManagedRulesSQLiRuleSet")).toBeInTheDocument());
    fireEvent.click(acl);
    await waitFor(() => expect(screen.queryByText("AWSManagedRulesSQLiRuleSet")).not.toBeInTheDocument());
  });

  it("shows all-recommendations-enabled and no-rules empty states", async () => {
    const detail = { ...DETAIL, rules: [], managedRules: [], customRules: [], recommendations: [] };
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/waf/detail": detail, "/api/waf": LIST }));
    renderWithProviders(<WafSection />, { profile: "proj-prod" });
    const acl = await screen.findByText("prod-waf");
    fireEvent.click(acl);
    await waitFor(() => expect(screen.getByText(/All recommended AWS Managed Rule Groups are enabled/i)).toBeInTheDocument());
    expect(screen.getByText(/No active rules/i)).toBeInTheDocument();
    expect(screen.getByText(/No disabled or overridden rules/i)).toBeInTheDocument();
  });

  it("shows an error message when detail fetch fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/config")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      }
      if (url.includes("/api/waf/detail")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ error: "request failed" }) });
      }
      if (url.includes("/api/waf")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(LIST) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<WafSection />, { profile: "proj-prod" });
    const acl = await screen.findByText("prod-waf");
    fireEvent.click(acl);
    await waitFor(() => expect(screen.getByText(/Failed to load WebACL detail/i)).toBeInTheDocument());
  });
});
