// src/__tests__/api/security.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cloudformation", () => ({
  CloudFormationClient: vi.fn(function () { return { send: mockSend }; }),
  ListStacksCommand: vi.fn(),
  DescribeStacksCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/security/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/security", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/security"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/security?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns stacks with correct shape and applies filter", async () => {
    mockSend.mockResolvedValueOnce({
      StackSummaries: [
        { StackName: "iam-roles-stack", StackStatus: "CREATE_COMPLETE", CreationTime: new Date("2023-01-01"), LastUpdatedTime: new Date("2023-06-01"), TemplateDescription: "IAM roles" },
        { StackName: "waf-rules-stack", StackStatus: "UPDATE_COMPLETE", CreationTime: new Date("2023-02-01"), LastUpdatedTime: undefined, TemplateDescription: "WAF rules" },
        { StackName: "app-stack", StackStatus: "CREATE_COMPLETE", CreationTime: new Date("2023-01-01"), LastUpdatedTime: undefined, TemplateDescription: "Application" },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/security?profile=proj-prod&filter=iam|waf"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stacks).toHaveLength(2);
    expect(data.stacks[0].name).toBe("iam-roles-stack");
    expect(data.stacks[1].name).toBe("waf-rules-stack");
  });

  it("returns all stacks when no filter given", async () => {
    mockSend.mockResolvedValueOnce({
      StackSummaries: [
        { StackName: "stack-1", StackStatus: "CREATE_COMPLETE", CreationTime: new Date(), TemplateDescription: "" },
        { StackName: "stack-2", StackStatus: "UPDATE_COMPLETE", CreationTime: new Date(), TemplateDescription: "" },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/security?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stacks).toHaveLength(2);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/security?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles stacks with null fields", async () => {
    mockSend.mockResolvedValueOnce({
      StackSummaries: [{
        StackName: undefined,
        StackStatus: undefined,
        CreationTime: undefined,
        LastUpdatedTime: undefined,
        TemplateDescription: undefined,
      }],
    });

    const res = await GET(new NextRequest("http://localhost/api/security?profile=proj-prod"));
    const data = await res.json();
    expect(data.stacks[0].name).toBe("");
    expect(data.stacks[0].status).toBe("");
  });
});
