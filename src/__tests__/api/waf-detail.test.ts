// src/__tests__/api/waf-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-wafv2", () => ({
  WAFV2Client: vi.fn(function () { return { send: mockSend }; }),
  GetWebACLCommand: vi.fn(),
  ListResourcesForWebACLCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/waf/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/waf/detail", () => {
  it("returns 400 when required params missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/waf/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when id missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/waf/detail?profile=proj-prod&name=my-waf"));
    expect(res.status).toBe(400);
  });

  it("returns WAF ACL detail with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        WebACL: {
          Name: "my-waf-acl",
          ARN: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-123",
          Capacity: 1500,
          DefaultAction: { Allow: {} },
          Rules: [
            {
              Name: "AWSManagedRulesCommonRuleSet",
              Priority: 1,
              OverrideAction: {},
              Statement: { ManagedRuleGroupStatement: { VendorName: "AWS", Name: "AWSManagedRulesCommonRuleSet" } },
            },
            {
              Name: "RateLimit",
              Priority: 2,
              Action: { Block: {} },
              Statement: { RateBasedStatement: { Limit: 2000 } },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ResourceArns: ["arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc"],
      });

    const res = await GET(new NextRequest("http://localhost/api/waf/detail?profile=proj-prod&id=acl-id-123&name=my-waf-acl"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      name: "my-waf-acl",
      capacity: 1500,
      defaultAction: "Allow",
    });
    expect(data.rules).toHaveLength(2);
    expect(data.rules[0]).toMatchObject({ name: "AWSManagedRulesCommonRuleSet", priority: 1 });
    expect(data.associatedResources).toHaveLength(1);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("WAFNonexistentItemException"));
    const res = await GET(new NextRequest("http://localhost/api/waf/detail?profile=proj-prod&id=bad-id&name=bad-name"));
    expect(res.status).toBe(500);
  });

  it("handles various rule types and actions", async () => {
    mockSend
      .mockResolvedValueOnce({
        WebACL: {
          Name: "my-waf-acl",
          ARN: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/my-waf-acl/acl-id-123",
          Capacity: 2000,
          DefaultAction: { Block: {} },
          Rules: [
            // Rate-based rule with no Action (OverrideAction)
            {
              Name: "RateLimit",
              Priority: 1,
              Action: undefined,
              OverrideAction: { Count: {} },
              Statement: { RateBasedStatement: { Limit: 2000, AggregateKeyType: "IP" } },
            },
            // Rule group reference
            {
              Name: "RuleGroup",
              Priority: 2,
              Action: { Block: {} },
              Statement: { RuleGroupReferenceStatement: { ARN: "arn:aws:wafv2:ap-southeast-1:111:regional/rulegroup/my-rg/abc" } },
            },
            // Custom rule (no known statement type)
            {
              Name: "CustomRule",
              Priority: 3,
              Action: undefined,
              OverrideAction: undefined,
              Statement: { ByteMatchStatement: {} }, // not a known type
            },
          ],
        },
      })
      .mockResolvedValueOnce({ ResourceArns: [] });

    const res = await GET(new NextRequest("http://localhost/api/waf/detail?profile=proj-prod&id=acl-id-123&name=my-waf-acl"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.defaultAction).toBe("Block");
    expect(data.rules[0].action).toBe("override"); // OverrideAction path
    expect(data.rules[0].type).toBe("RateBased");
    expect(data.rules[1].type).toBe("RuleGroup");
    expect(data.rules[2].action).toBe("none"); // neither Action nor OverrideAction
    expect(data.rules[2].type).toBe("Custom");
  });

  it("handles WAF with no rules and no default action", async () => {
    mockSend
      .mockResolvedValueOnce({
        WebACL: {
          Name: "empty-waf",
          ARN: "arn:aws:wafv2:ap-southeast-1:111:regional/webacl/empty-waf/abc",
          Capacity: 0,
          DefaultAction: undefined, // no default action
          Rules: [],
        },
      })
      .mockResolvedValueOnce({ ResourceArns: ["arn:alb1", "arn:alb2"] });

    const res = await GET(new NextRequest("http://localhost/api/waf/detail?profile=proj-prod&id=abc&name=empty-waf"));
    const data = await res.json();
    expect(data.defaultAction).toBe("unknown");
    expect(data.rules).toHaveLength(0);
    expect(data.associatedResources).toHaveLength(2);
  });
});
