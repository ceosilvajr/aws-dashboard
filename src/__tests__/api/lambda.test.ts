// src/__tests__/api/lambda.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn(function () { return { send: mockSend }; }),
  ListFunctionsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/lambda/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/lambda", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/lambda"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/lambda?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns functions with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      Functions: [
        {
          FunctionName: "my-function",
          Runtime: "nodejs18.x",
          MemorySize: 128,
          Timeout: 30,
          LastModified: "2024-01-01T00:00:00.000+0000",
          State: "Active",
        },
      ],
      NextMarker: undefined,
    });

    const res = await GET(new NextRequest("http://localhost/api/lambda?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.functions).toHaveLength(1);
    expect(data.functions[0]).toMatchObject({
      name: "my-function",
      runtime: "nodejs18.x",
      memory: 128,
      timeout: 30,
    });
  });

  it("handles pagination with NextMarker", async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{ FunctionName: "fn1", Runtime: "nodejs18.x", MemorySize: 128, Timeout: 30, LastModified: "", State: "Active" }],
        NextMarker: "marker1",
      })
      .mockResolvedValueOnce({
        Functions: [{ FunctionName: "fn2", Runtime: "python3.11", MemorySize: 256, Timeout: 60, LastModified: "", State: "Active" }],
        NextMarker: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/lambda?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.functions).toHaveLength(2);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/lambda?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles functions with null/undefined optional fields", async () => {
    mockSend.mockResolvedValueOnce({
      Functions: [
        {
          FunctionName: undefined,
          Runtime: undefined,
          MemorySize: undefined,
          Timeout: undefined,
          LastModified: undefined,
          State: undefined,
        },
      ],
      NextMarker: undefined,
    });

    const res = await GET(new NextRequest("http://localhost/api/lambda?profile=proj-prod"));
    const data = await res.json();
    expect(data.functions[0].name).toBe("");
    expect(data.functions[0].runtime).toBe("");
    expect(data.functions[0].memory).toBe(0);
    expect(data.functions[0].timeout).toBe(0);
    expect(data.functions[0].lastModified).toBe("");
    expect(data.functions[0].state).toBe("Active"); // fallback default
  });
});
