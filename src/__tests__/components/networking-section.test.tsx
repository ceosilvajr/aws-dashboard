// src/__tests__/components/networking-section.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeConfigFetch } from "../test-utils";
import { NetworkingSection } from "@/components/sections/networking-section";

afterEach(() => { vi.unstubAllGlobals(); });

describe("NetworkingSection", () => {
  it("shows RequireProfile prompt when no profile selected", () => {
    vi.stubGlobal("fetch", makeConfigFetch());
    renderWithProviders(<NetworkingSection />, { profile: null });
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
  });

  it("renders ALB tab by default and shows subgroup buttons", async () => {
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/alb": { loadBalancers: [] },
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    // Should show subgroup buttons
    await waitFor(() => expect(screen.getByText("WAF")).toBeInTheDocument());
    expect(screen.getByText("ALB")).toBeInTheDocument();
    expect(screen.getByText("VPC")).toBeInTheDocument();
    expect(screen.getByText("Route53")).toBeInTheDocument();
  });

  it("renders WAF ACL data when WAF tab is clicked", async () => {
    const mockAcls = [{ id: "acl-id-1", name: "my-waf-acl", arn: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-1" }];
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/alb": { loadBalancers: [] },
      "/api/waf": { acls: mockAcls },
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("WAF")).toBeInTheDocument());
    fireEvent.click(screen.getByText("WAF"));

    await waitFor(() => expect(screen.getByText("my-waf-acl")).toBeInTheDocument());
  });

  it("renders VPC data when VPC tab is clicked", async () => {
    const mockVpcs = [{ vpcId: "vpc-123", name: "main-vpc", cidr: "10.0.0.0/16", state: "available", isDefault: false, subnetCount: 3 }];
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/alb": { loadBalancers: [] },
      "/api/vpc": { vpcs: mockVpcs },
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("VPC")).toBeInTheDocument());
    fireEvent.click(screen.getByText("VPC"));

    await waitFor(() => expect(screen.getByText("main-vpc")).toBeInTheDocument());
    expect(screen.getByText("vpc-123")).toBeInTheDocument();
  });

  it("renders Route53 zones when Route53 tab is clicked", async () => {
    const mockZones = [{ id: "Z123", name: "example.com.", type: "Public", recordCount: 5 }];
    vi.stubGlobal("fetch", makeConfigFetch({
      "/api/alb": { loadBalancers: [] },
      "/api/route53": { zones: mockZones },
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("Route53")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Route53"));

    await waitFor(() => expect(screen.getByText("example.com.")).toBeInTheDocument());
  });

  it("renders ALB load balancer data", async () => {
    const mockLbs = [{
      name: "my-alb",
      dnsName: "my-alb.ap-southeast-1.elb.amazonaws.com",
      scheme: "internet-facing",
      state: "active",
      type: "application",
      listeners: [{
        port: 443,
        protocol: "HTTPS",
        rules: [{ priority: "1", isDefault: false, conditions: [{ field: "path-pattern", values: ["/api/*"], hostHeader: [], pathPattern: ["/api/*"] }], actions: [{ type: "forward", targetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123", forwardConfig: [] }] }],
      }],
    }];
    vi.stubGlobal("fetch", makeConfigFetch({ "/api/alb": { loadBalancers: mockLbs } }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    await waitFor(() => expect(screen.getByText("my-alb")).toBeInTheDocument());
    expect(screen.getByText("my-alb.ap-southeast-1.elb.amazonaws.com")).toBeInTheDocument();
  });

  it("navigates to VPC detail view when VPC row is clicked", async () => {
    const mockVpcs = [{ vpcId: "vpc-123", name: "main-vpc", cidr: "10.0.0.0/16", state: "available", isDefault: false, subnetCount: 3 }];
    const mockVpcDetail = {
      vpcId: "vpc-123",
      name: "main-vpc",
      cidr: "10.0.0.0/16",
      state: "available",
      isDefault: false,
      dnsHostnames: true,
      dnsResolution: true,
      subnets: [{ subnetId: "subnet-1", cidr: "10.0.1.0/24", az: "ap-southeast-1a", availableIps: 250, mapPublicIp: true, name: "public-1" }],
      routeTables: [],
      securityGroups: [{ id: "sg-1", name: "default", description: "Default SG", inboundCount: 2, outboundCount: 1 }],
      natGateways: [],
    };

    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/vpc/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVpcDetail) });
      if (url.includes("/api/vpc")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ vpcs: mockVpcs }) });
      if (url.includes("/api/alb")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ loadBalancers: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    fireEvent.click(screen.getByText("VPC"));
    await waitFor(() => expect(screen.getByText("main-vpc")).toBeInTheDocument());
    fireEvent.click(screen.getByText("main-vpc").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    // VPC detail shows subnets
    await waitFor(() => expect(screen.getByText("subnet-1")).toBeInTheDocument());
  });

  it("navigates to Route53 detail view when zone row is clicked", async () => {
    const mockZones = [{ id: "Z123", name: "example.com.", type: "Public", recordCount: 5 }];
    const mockZoneDetail = {
      id: "Z123",
      name: "example.com.",
      type: "Public",
      recordCount: 5,
      vpcs: [],
      records: [{ name: "example.com.", type: "A", ttl: 300, values: ["1.2.3.4"] }],
    };

    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/route53/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockZoneDetail) });
      if (url.includes("/api/route53")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ zones: mockZones }) });
      if (url.includes("/api/alb")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ loadBalancers: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    fireEvent.click(screen.getByText("Route53"));
    await waitFor(() => expect(screen.getByText("example.com.")).toBeInTheDocument());
    fireEvent.click(screen.getByText("example.com.").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());
    // Route53 detail shows records
    await waitFor(() => expect(screen.getByText("1.2.3.4")).toBeInTheDocument());
  });

  it("shows managed/custom rules with status and recommendations in WAF detail", async () => {
    const mockAcls = [{ id: "acl-id-1", name: "my-waf-acl", arn: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-1" }];
    const mockWafDetail = {
      name: "my-waf-acl",
      arn: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-1",
      capacity: 1500,
      defaultAction: "Allow",
      rules: [
        { name: "AWSManagedRulesCommonRuleSet", priority: 1, action: "override", type: "Managed: AWS/AWSManagedRulesCommonRuleSet", category: "managed", status: "enabled", managedRuleName: "AWSManagedRulesCommonRuleSet" },
        { name: "SQLiCounting", priority: 2, action: "override", type: "Managed: AWS/AWSManagedRulesSQLiRuleSet", category: "managed", status: "overridden", managedRuleName: "AWSManagedRulesSQLiRuleSet" },
        { name: "MyCustomBlock", priority: 3, action: "block", type: "Custom", category: "custom", status: "enabled" },
        { name: "DisabledCustom", priority: 4, action: "none", type: "Custom", category: "custom", status: "disabled" },
      ],
      managedRules: [
        { name: "AWSManagedRulesCommonRuleSet", priority: 1, action: "override", type: "Managed: AWS/AWSManagedRulesCommonRuleSet", category: "managed", status: "enabled", managedRuleName: "AWSManagedRulesCommonRuleSet" },
        { name: "SQLiCounting", priority: 2, action: "override", type: "Managed: AWS/AWSManagedRulesSQLiRuleSet", category: "managed", status: "overridden", managedRuleName: "AWSManagedRulesSQLiRuleSet" },
      ],
      customRules: [
        { name: "MyCustomBlock", priority: 3, action: "block", type: "Custom", category: "custom", status: "enabled" },
        { name: "DisabledCustom", priority: 4, action: "none", type: "Custom", category: "custom", status: "disabled" },
      ],
      recommendations: [
        { name: "AWSManagedRulesKnownBadInputsRuleSet", vendor: "AWS", description: "Blocks known-bad request patterns." },
        { name: "AWSManagedRulesLinuxRuleSet", vendor: "AWS", description: "Blocks Linux-specific exploitation patterns." },
      ],
      associatedResources: [],
    };

    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/config")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }) });
      if (url.includes("/api/waf/detail")) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWafDetail) });
      if (url.includes("/api/waf")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ acls: mockAcls }) });
      if (url.includes("/api/alb")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ loadBalancers: [] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
    renderWithProviders(<NetworkingSection />, { profile: "proj-prod" });

    fireEvent.click(screen.getByText("WAF"));
    await waitFor(() => expect(screen.getByText("my-waf-acl")).toBeInTheDocument());
    fireEvent.click(screen.getByText("my-waf-acl").closest("tr")!);

    await waitFor(() => expect(screen.getByText("Back")).toBeInTheDocument());

    // Managed rules group is present with both managed rule names
    await waitFor(() => expect(screen.getByText("AWSManagedRulesCommonRuleSet")).toBeInTheDocument());
    expect(screen.getByText("SQLiCounting")).toBeInTheDocument();
    // Custom rules group
    expect(screen.getByText("MyCustomBlock")).toBeInTheDocument();
    expect(screen.getByText("DisabledCustom")).toBeInTheDocument();
    // Status text is rendered (at least one enabled, one overridden, one disabled)
    expect(screen.getAllByText("enabled").length).toBeGreaterThan(0);
    expect(screen.getByText("overridden")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
    // Recommendations section lists the not-enabled rule groups
    expect(screen.getByText("AWSManagedRulesKnownBadInputsRuleSet")).toBeInTheDocument();
    expect(screen.getByText("AWSManagedRulesLinuxRuleSet")).toBeInTheDocument();
  });
});
