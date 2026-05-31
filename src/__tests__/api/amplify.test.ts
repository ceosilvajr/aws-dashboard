// src/__tests__/api/amplify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-amplify", () => ({
  AmplifyClient: vi.fn(function () { return { send: mockSend }; }),
  ListAppsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/amplify/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/amplify", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/amplify"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/amplify?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns apps with correct shape", async () => {
    mockSend.mockResolvedValueOnce({
      apps: [
        {
          appId: "app1",
          name: "my-app",
          platform: "WEB",
          repository: "https://github.com/org/repo",
          defaultDomain: "main.abc123.amplifyapp.com",
          updateTime: new Date("2024-01-01"),
        },
        {
          // Non-web platform should be filtered out
          appId: "app2",
          name: "native-app",
          platform: "REACT_NATIVE",
          repository: "",
          defaultDomain: "",
          updateTime: new Date("2024-01-01"),
        },
      ],
      nextToken: undefined,
    });

    const res = await GET(new NextRequest("http://localhost/api/amplify?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.apps).toHaveLength(1);
    expect(data.apps[0]).toMatchObject({
      appId: "app1",
      name: "my-app",
      platform: "WEB",
    });
  });

  it("handles pagination with nextToken", async () => {
    mockSend
      .mockResolvedValueOnce({
        apps: [{ appId: "app1", name: "app-one", platform: "WEB_COMPUTE", repository: "", defaultDomain: "", updateTime: new Date() }],
        nextToken: "token1",
      })
      .mockResolvedValueOnce({
        apps: [{ appId: "app2", name: "app-two", platform: "WEB_DYNAMIC", repository: "", defaultDomain: "", updateTime: new Date() }],
        nextToken: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/amplify?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.apps).toHaveLength(2);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/amplify?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles apps with null fields", async () => {
    mockSend.mockResolvedValueOnce({
      apps: [
        {
          appId: undefined,
          name: undefined,
          platform: "WEB",
          repository: undefined,
          defaultDomain: undefined,
          updateTime: undefined,
        },
      ],
      nextToken: undefined,
    });

    const res = await GET(new NextRequest("http://localhost/api/amplify?profile=proj-prod"));
    const data = await res.json();
    expect(data.apps).toHaveLength(1);
    expect(data.apps[0].appId).toBe("");
    expect(data.apps[0].name).toBe("");
    expect(data.apps[0].repository).toBe("");
    expect(data.apps[0].defaultDomain).toBe("");
    expect(data.apps[0].updateTime).toBe("");
  });
});
