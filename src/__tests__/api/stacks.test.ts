// src/__tests__/api/stacks.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cloudformation", () => ({
  CloudFormationClient: vi.fn(function () { return { send: mockSend }; }),
  ListStacksCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/stacks/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/stacks", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/stacks"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/stacks?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns stacks with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      StackSummaries: [
        {
          StackName: "my-app-stack",
          StackStatus: "CREATE_COMPLETE",
          CreationTime: new Date("2023-01-01"),
          LastUpdatedTime: new Date("2023-06-01"),
          TemplateDescription: "My application stack",
        },
        {
          StackName: "another-stack",
          StackStatus: "UPDATE_COMPLETE",
          CreationTime: new Date("2023-02-01"),
          LastUpdatedTime: undefined,
          TemplateDescription: "",
        },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/stacks?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stacks).toHaveLength(2);
    expect(data.stacks[0]).toMatchObject({
      name: "my-app-stack",
      status: "CREATE_COMPLETE",
      description: "My application stack",
    });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/stacks?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles empty stacks list", async () => {
    mockSend.mockResolvedValueOnce({ StackSummaries: [] });
    const res = await GET(new NextRequest("http://localhost/api/stacks?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stacks).toEqual([]);
  });

  it("handles stacks with null/undefined fields", async () => {
    mockSend.mockResolvedValueOnce({
      StackSummaries: [
        {
          StackName: undefined,
          StackStatus: undefined,
          CreationTime: undefined,
          LastUpdatedTime: undefined,
          TemplateDescription: undefined,
        },
      ],
    });

    const res = await GET(new NextRequest("http://localhost/api/stacks?profile=proj-prod"));
    const data = await res.json();
    expect(data.stacks[0].name).toBe("");
    expect(data.stacks[0].status).toBe("");
    expect(data.stacks[0].created).toBe("");
    expect(data.stacks[0].updated).toBe("");
    expect(data.stacks[0].description).toBe("");
  });

  it("handles null StackSummaries", async () => {
    mockSend.mockResolvedValueOnce({ StackSummaries: null });
    const res = await GET(new NextRequest("http://localhost/api/stacks?profile=proj-prod"));
    const data = await res.json();
    expect(data.stacks).toEqual([]);
  });
});
