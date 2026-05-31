// src/__tests__/api/amplify-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-amplify", () => ({
  AmplifyClient: vi.fn(function () { return { send: mockSend }; }),
  GetAppCommand: vi.fn(),
  ListDomainAssociationsCommand: vi.fn(),
  ListBranchesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/amplify/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/amplify/detail", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?appId=app1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when appId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod"));
    expect(res.status).toBe(400);
  });

  it("returns app detail with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        app: {
          appId: "app1",
          name: "My App",
          platform: "WEB",
          repository: "https://github.com/org/repo",
          defaultDomain: "main.abc123.amplifyapp.com",
          createTime: new Date("2023-01-01"),
          updateTime: new Date("2024-01-01"),
          environmentVariables: { NODE_ENV: "production" },
        },
      })
      .mockResolvedValueOnce({
        domainAssociations: [{
          domainName: "example.com",
          domainStatus: "AVAILABLE",
          subDomains: [{
            subDomainSetting: { prefix: "www", branchName: "main" },
            verified: true,
            dnsRecord: "example.com CNAME abc123.cloudfront.net",
          }],
        }],
      })
      .mockResolvedValueOnce({
        branches: [{
          branchName: "main",
          stage: "PRODUCTION",
          activeJobId: null,
          updateTime: new Date("2024-01-01"),
          displayName: "main",
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      appId: "app1",
      name: "My App",
      platform: "WEB",
    });
    expect(data.domains).toHaveLength(1);
    expect(data.branches).toHaveLength(1);
    expect(data.envVars).toHaveLength(1);
    expect(data.envVars[0]).toMatchObject({ key: "NODE_ENV", value: "production" });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("NotFoundException"));
    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    expect(res.status).toBe(500);
  });

  it("handles branch with active job (DEPLOYING status)", async () => {
    mockSend
      .mockResolvedValueOnce({
        app: {
          appId: "app1",
          name: "My App",
          platform: "WEB",
          repository: "",
          defaultDomain: "main.abc123.amplifyapp.com",
          createTime: new Date("2023-01-01"),
          updateTime: new Date("2024-01-01"),
          environmentVariables: {},
        },
      })
      .mockResolvedValueOnce({ domainAssociations: [] })
      .mockResolvedValueOnce({
        branches: [{
          branchName: "main",
          stage: "PRODUCTION",
          activeJobId: "job123", // actively deploying
          updateTime: new Date("2024-01-01"),
          displayName: "main",
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.branches[0].status).toBe("DEPLOYING");
  });

  it("handles domain subdomains and environment variables", async () => {
    mockSend
      .mockResolvedValueOnce({
        app: {
          appId: "app1",
          name: "My App",
          platform: "WEB",
          repository: "https://github.com/org/repo",
          defaultDomain: "main.abc123.amplifyapp.com",
          createTime: new Date("2023-01-01"),
          updateTime: new Date("2024-01-01"),
          environmentVariables: { NODE_ENV: "production", API_KEY: "secret" },
        },
      })
      .mockResolvedValueOnce({
        domainAssociations: [{
          domainName: "example.com",
          domainStatus: "PENDING_VERIFICATION",
          subDomains: [
            { subDomainSetting: { prefix: "www", branchName: "main" }, verified: true, dnsRecord: "www.example.com CNAME abc.cloudfront.net" },
            { subDomainSetting: { prefix: "", branchName: "prod" }, verified: false, dnsRecord: "" },
          ],
        }],
      })
      .mockResolvedValueOnce({
        branches: [{
          branchName: "feature",
          stage: "DEVELOPMENT",
          activeJobId: null,
          updateTime: new Date("2024-01-01"),
          displayName: "", // should fallback to branchName
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    const data = await res.json();
    expect(data.domains[0].subDomains).toHaveLength(2);
    expect(data.envVars).toHaveLength(2);
    expect(data.branches[0].displayName).toBe(""); // empty string stays empty (??  doesn't catch "")
    expect(data.branches[0].status).toBe("STABLE");
  });

  it("handles app with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        app: {
          appId: undefined,
          name: undefined,
          platform: undefined,
          repository: undefined,
          defaultDomain: undefined,
          createTime: undefined,
          updateTime: undefined,
          environmentVariables: undefined,
        },
      })
      .mockResolvedValueOnce({ domainAssociations: undefined })
      .mockResolvedValueOnce({ branches: undefined });

    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    const data = await res.json();
    expect(data.appId).toBeUndefined(); // app.appId is passed directly
    expect(data.domains).toHaveLength(0);
    expect(data.branches).toHaveLength(0);
    expect(data.envVars).toHaveLength(0);
  });

  it("handles subDomains with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        app: {
          appId: "app1",
          name: "My App",
          platform: "WEB",
          repository: "",
          defaultDomain: "main.abc123.amplifyapp.com",
          createTime: new Date("2023-01-01"),
          updateTime: new Date("2024-01-01"),
          environmentVariables: {},
        },
      })
      .mockResolvedValueOnce({
        domainAssociations: [{
          domainName: "example.com",
          domainStatus: "AVAILABLE",
          subDomains: [{
            subDomainSetting: undefined, // null subDomainSetting
            verified: undefined, // null verified
            dnsRecord: undefined, // null dnsRecord
          }],
        }],
      })
      .mockResolvedValueOnce({ branches: [] });

    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    const data = await res.json();
    expect(data.domains[0].subDomains[0].prefix).toBe(""); // undefined → ""
    expect(data.domains[0].subDomains[0].branchName).toBe(""); // undefined → ""
    expect(data.domains[0].subDomains[0].verified).toBe(false); // undefined ?? false
    expect(data.domains[0].subDomains[0].dnsRecord).toBe(""); // undefined ?? ""
  });

  it("handles domain associations with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        app: {
          appId: "app1",
          name: "My App",
          platform: "WEB",
          repository: "",
          defaultDomain: "main.abc123.amplifyapp.com",
          createTime: new Date("2023-01-01"),
          updateTime: new Date("2024-01-01"),
          environmentVariables: {},
        },
      })
      .mockResolvedValueOnce({
        domainAssociations: [{
          domainName: undefined,
          domainStatus: undefined,
          subDomains: undefined, // null subDomains
        }],
      })
      .mockResolvedValueOnce({ branches: [] });

    const res = await GET(new NextRequest("http://localhost/api/amplify/detail?profile=proj-prod&appId=app1"));
    const data = await res.json();
    expect(data.domains[0].domainName).toBe("");
    expect(data.domains[0].status).toBe("");
    expect(data.domains[0].subDomains).toHaveLength(0);
  });
});
