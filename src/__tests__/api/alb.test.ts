// src/__tests__/api/alb.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-elastic-load-balancing-v2", () => ({
  ElasticLoadBalancingV2Client: vi.fn(function () { return { send: mockSend }; }),
  DescribeLoadBalancersCommand: vi.fn(),
  DescribeListenersCommand: vi.fn(),
  DescribeRulesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/alb/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/alb", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/alb"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/alb?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns loadBalancers with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: "my-alb",
          DNSName: "my-alb.example.com",
          Scheme: "internet-facing",
          State: { Code: "active" },
          Type: "application",
          LoadBalancerArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc",
        }],
      })
      .mockResolvedValueOnce({
        Listeners: [{
          Port: 443,
          Protocol: "HTTPS",
          ListenerArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:listener/app/my-alb/abc/def",
        }],
      })
      .mockResolvedValueOnce({
        Rules: [{
          Priority: "1",
          IsDefault: false,
          Conditions: [{ Field: "path-pattern", Values: ["/api/*"], PathPatternConfig: { Values: ["/api/*"] } }],
          Actions: [{ Type: "forward", TargetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123", ForwardConfig: { TargetGroups: [{ TargetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123" }] } }],
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loadBalancers).toHaveLength(1);
    expect(data.loadBalancers[0]).toMatchObject({
      name: "my-alb",
      dnsName: "my-alb.example.com",
      scheme: "internet-facing",
      state: "active",
      type: "application",
    });
    expect(data.loadBalancers[0].listeners).toHaveLength(1);
    expect(data.loadBalancers[0].listeners[0].port).toBe(443);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles empty load balancers list", async () => {
    mockSend.mockResolvedValueOnce({ LoadBalancers: [] });
    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loadBalancers).toEqual([]);
  });

  it("handles load balancer with no listeners", async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: "my-alb",
          DNSName: "my-alb.example.com",
          Scheme: "internal",
          State: { Code: "active" },
          Type: "application",
          LoadBalancerArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc",
        }],
      })
      .mockResolvedValueOnce({ Listeners: [] });

    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    const data = await res.json();
    expect(data.loadBalancers[0].listeners).toHaveLength(0);
    expect(data.loadBalancers[0].scheme).toBe("internal");
  });

  it("handles load balancers with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: undefined,
          DNSName: undefined,
          Scheme: undefined,
          State: undefined, // null State
          Type: undefined,
          LoadBalancerArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc",
        }],
      })
      .mockResolvedValueOnce({ Listeners: [] });

    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    const data = await res.json();
    expect(data.loadBalancers[0].name).toBe("");
    expect(data.loadBalancers[0].dnsName).toBe("");
    expect(data.loadBalancers[0].scheme).toBe("");
    expect(data.loadBalancers[0].state).toBe(""); // null State → ""
    expect(data.loadBalancers[0].type).toBe("");
  });

  it("handles listeners with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: "my-alb",
          DNSName: "my-alb.example.com",
          Scheme: "internet-facing",
          State: { Code: "active" },
          Type: "application",
          LoadBalancerArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc",
        }],
      })
      .mockResolvedValueOnce({
        Listeners: [{
          Port: undefined, // null port
          Protocol: undefined, // null protocol
          ListenerArn: "arn:listener/1",
        }],
      })
      .mockResolvedValueOnce({
        Rules: [{
          Priority: undefined,
          IsDefault: undefined,
          Conditions: undefined, // null conditions
          Actions: undefined, // null actions
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    const data = await res.json();
    const listener = data.loadBalancers[0].listeners[0];
    expect(listener.port).toBe(0);
    expect(listener.protocol).toBe("");
    expect(listener.rules[0].priority).toBe("");
    expect(listener.rules[0].isDefault).toBe(false);
    expect(listener.rules[0].conditions).toHaveLength(0);
    expect(listener.rules[0].actions).toHaveLength(0);
  });

  it("handles conditions with Values fallback (no HostHeaderConfig/PathPatternConfig)", async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: "my-alb",
          DNSName: "my-alb.example.com",
          Scheme: "internet-facing",
          State: { Code: "active" },
          Type: "application",
          LoadBalancerArn: "arn:alb",
        }],
      })
      .mockResolvedValueOnce({ Listeners: [{ Port: 443, Protocol: "HTTPS", ListenerArn: "arn:listener/1" }] })
      .mockResolvedValueOnce({
        Rules: [{
          Priority: "1",
          IsDefault: false,
          Conditions: [
            // host-header WITHOUT HostHeaderConfig (falls back to Values)
            { Field: "host-header", Values: ["api.example.com"], HostHeaderConfig: undefined },
            // path-pattern WITHOUT PathPatternConfig (falls back to Values)
            { Field: "path-pattern", Values: ["/api/*"], PathPatternConfig: undefined },
          ],
          Actions: [
            { Type: "forward", TargetGroupArn: undefined, ForwardConfig: undefined }, // null ForwardConfig
          ],
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    const data = await res.json();
    const rule = data.loadBalancers[0].listeners[0].rules[0];
    // When HostHeaderConfig is undefined, hostHeader = [] and values = Values
    expect(rule.conditions[0].hostHeader).toEqual([]); // HostHeaderConfig undefined → []
    expect(rule.conditions[0].values).toEqual(["api.example.com"]); // raw Values
    // When PathPatternConfig is undefined, pathPattern = [] and values = Values
    expect(rule.conditions[1].pathPattern).toEqual([]); // PathPatternConfig undefined → []
    expect(rule.conditions[1].values).toEqual(["/api/*"]); // raw Values
    expect(rule.actions[0].forwardConfig).toEqual([]); // null ForwardConfig → []
  });

  it("handles rules with host-header conditions and various action types", async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: "my-alb",
          DNSName: "my-alb.example.com",
          Scheme: "internet-facing",
          State: { Code: "active" },
          Type: "application",
          LoadBalancerArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc",
        }],
      })
      .mockResolvedValueOnce({
        Listeners: [{
          Port: 80,
          Protocol: "HTTP",
          ListenerArn: "arn:listener/1",
        }],
      })
      .mockResolvedValueOnce({
        Rules: [
          {
            Priority: "1",
            IsDefault: false,
            Conditions: [
              { Field: "host-header", Values: [], HostHeaderConfig: { Values: ["api.example.com"] } },
              { Field: "path-pattern", Values: [], PathPatternConfig: { Values: ["/api/*"] } },
            ],
            Actions: [{ Type: "forward", TargetGroupArn: "arn:tg", ForwardConfig: { TargetGroups: [{ TargetGroupArn: "arn:tg" }] } }],
          },
          {
            Priority: "default",
            IsDefault: true,
            Conditions: [],
            Actions: [{ Type: "fixed-response", TargetGroupArn: "" }],
          },
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/alb?profile=proj-prod"));
    const data = await res.json();
    expect(data.loadBalancers[0].listeners[0].rules).toHaveLength(2);
    expect(data.loadBalancers[0].listeners[0].rules[0].conditions[0].hostHeader).toEqual(["api.example.com"]);
    expect(data.loadBalancers[0].listeners[0].rules[0].conditions[1].pathPattern).toEqual(["/api/*"]);
  });
});
