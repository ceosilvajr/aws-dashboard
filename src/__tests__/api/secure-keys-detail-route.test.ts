import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn(function () { return { send: sendMock }; }),
  DescribeSecretCommand: vi.fn(function (this: Record<string, unknown>, input: unknown) { this.__type = "DescribeSecret"; this.input = input; }),
}));
vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: vi.fn(function () { return { send: sendMock }; }),
  GetParameterCommand: vi.fn(function (this: Record<string, unknown>, input: unknown) { this.__type = "GetParameter"; this.input = input; }),
  DescribeParametersCommand: vi.fn(function (this: Record<string, unknown>, input: unknown) { this.__type = "DescribeParameters"; this.input = input; }),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));

import { GET } from "@/app/api/secure-keys/detail/route";
import { NextRequest } from "next/server";

function req(url: string) { return new NextRequest(new URL(url, "http://localhost")); }

beforeEach(() => { sendMock.mockReset(); });

describe("GET /api/secure-keys/detail", () => {
  it("400s when profile is missing", async () => {
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=secret&id=arn:1"));
    expect(res.status).toBe(400);
  });

  it("400s when kind is invalid", async () => {
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=bogus&profile=p&id=x"));
    expect(res.status).toBe(400);
  });

  it("returns secret metadata", async () => {
    sendMock.mockResolvedValue({
      Name: "db/password", ARN: "arn:1", Description: "db",
      RotationEnabled: true, LastChangedDate: new Date("2024-01-01"),
      LastAccessedDate: null, CreatedDate: new Date("2023-01-01"),
      Tags: [{ Key: "env", Value: "prod" }],
    });
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=secret&id=arn:1&profile=p"));
    const body = await res.json();
    expect(body).toMatchObject({ kind: "secret", name: "db/password", rotationEnabled: true });
    expect(body.tags).toEqual([{ key: "env", value: "prod" }]);
  });

  it("returns parameter metadata without decrypting the value", async () => {
    sendMock.mockImplementation((cmd: { __type: string; input: Record<string, unknown> }) => {
      if (cmd.__type === "GetParameter") {
        expect(cmd.input.WithDecryption).toBe(false);
        return Promise.resolve({ Parameter: { Name: "/app/key", Type: "SecureString", Version: 3, LastModifiedDate: new Date("2024-02-02"), DataType: "text" } });
      }
      return Promise.resolve({ Parameters: [{ Description: "app key", Tier: "Standard" }] });
    });
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=parameter&name=/app/key&profile=p"));
    const body = await res.json();
    expect(body).toMatchObject({ kind: "parameter", name: "/app/key", type: "SecureString", version: 3, tier: "Standard" });
    expect(body).not.toHaveProperty("value");
  });

  it("500s when the service throws", async () => {
    sendMock.mockRejectedValue(new Error("boom"));
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=secret&id=arn:1&profile=p"));
    expect(res.status).toBe(500);
  });

  it("400s when a secret request has neither id nor name", async () => {
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=secret&profile=p"));
    expect(res.status).toBe(400);
  });

  it("400s when a parameter request has no name", async () => {
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=parameter&profile=p"));
    expect(res.status).toBe(400);
  });

  it("falls back to name as secret id when id is absent and applies field fallbacks", async () => {
    const captured: Record<string, unknown>[] = [];
    sendMock.mockImplementation((cmd: { input: Record<string, unknown> }) => {
      captured.push(cmd.input);
      return Promise.resolve({}); // sparse response exercises all ?? fallbacks
    });
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=secret&name=db/password&profile=p"));
    const body = await res.json();
    expect(captured[0].SecretId).toBe("db/password");
    expect(body).toEqual({
      kind: "secret", name: "", arn: "", description: "",
      rotationEnabled: false, lastChangedDate: null, lastAccessedDate: null, createdDate: null, tags: [],
    });
  });

  it("applies fallbacks for a parameter when SDK omits optional fields", async () => {
    sendMock.mockImplementation((cmd: { __type: string }) => {
      if (cmd.__type === "GetParameter") return Promise.resolve({ Parameter: {} });
      return Promise.resolve({ Parameters: [] });
    });
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=parameter&name=/app/key&profile=p"));
    const body = await res.json();
    expect(body).toEqual({
      kind: "parameter", name: "/app/key", type: "", version: 0,
      lastModifiedDate: null, description: "", tier: "", dataType: "",
    });
  });

  it("maps a secret tag with missing key/value to empty strings", async () => {
    sendMock.mockResolvedValue({ Name: "s", Tags: [{}] });
    const res = await GET(req("http://localhost/api/secure-keys/detail?kind=secret&id=arn:1&profile=p"));
    const body = await res.json();
    expect(body.tags).toEqual([{ key: "", value: "" }]);
  });
});
