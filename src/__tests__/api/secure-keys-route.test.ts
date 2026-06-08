import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn(function () { return { send: sendMock }; }),
  ListSecretsCommand: vi.fn(function (this: Record<string, unknown>, input: unknown) { this.__type = "ListSecrets"; this.input = input; }),
}));
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn(function () { return { send: sendMock }; }),
  DescribeParametersCommand: vi.fn(function (this: Record<string, unknown>, input: unknown) { this.__type = "DescribeParameters"; this.input = input; }),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({
  getAccounts: vi.fn(async () => [{ name: "proj-prod", id: "111", profile: "proj-prod" }]),
}));

import { GET } from "@/app/api/secure-keys/route";
import { NextRequest } from "next/server";

function req(url: string) { return new NextRequest(new URL(url, "http://localhost")); }

beforeEach(() => { sendMock.mockReset(); });

describe("GET /api/secure-keys", () => {
  it("returns secrets and parameters for a profile", async () => {
    sendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "ListSecrets") {
        return Promise.resolve({
          SecretList: [{ Name: "db/password", ARN: "arn:secret:1", Description: "db", LastChangedDate: new Date("2024-01-01"), LastAccessedDate: null }],
          NextToken: undefined,
        });
      }
      return Promise.resolve({
        Parameters: [{ Name: "/app/key", Type: "SecureString", LastModifiedDate: new Date("2024-02-02"), Version: 3 }],
        NextToken: undefined,
      });
    });

    const res = await GET(req("http://localhost/api/secure-keys?profile=proj-prod"));
    const body = await res.json();

    expect(body.secrets).toHaveLength(1);
    expect(body.secrets[0]).toMatchObject({ name: "db/password", arn: "arn:secret:1", description: "db" });
    expect(body.parameters).toHaveLength(1);
    expect(body.parameters[0]).toMatchObject({ name: "/app/key", type: "SecureString", version: 3 });
  });

  it("returns empty arrays when a service call throws", async () => {
    sendMock.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(req("http://localhost/api/secure-keys?profile=proj-prod"));
    const body = await res.json();
    expect(body.secrets).toEqual([]);
    expect(body.parameters).toEqual([]);
  });

  it("applies fallbacks when SDK items omit optional fields", async () => {
    sendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "ListSecrets") {
        return Promise.resolve({ SecretList: [{}], NextToken: undefined });
      }
      return Promise.resolve({ Parameters: [{}], NextToken: undefined });
    });
    const res = await GET(req("http://localhost/api/secure-keys?profile=proj-prod"));
    const body = await res.json();
    expect(body.secrets[0]).toEqual({ name: "", arn: "", description: "", lastChangedDate: null, lastAccessedDate: null });
    expect(body.parameters[0]).toEqual({ name: "", type: "", lastModifiedDate: null, version: 0 });
  });

  it("fans out across all accounts when no profile is given", async () => {
    sendMock.mockResolvedValue({ SecretList: [], Parameters: [] });
    const res = await GET(req("http://localhost/api/secure-keys"));
    const body = await res.json();
    expect(body.secrets).toEqual([]);
    expect(body.parameters).toEqual([]);
  });
});
