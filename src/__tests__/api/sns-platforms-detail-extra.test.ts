// src/__tests__/api/sns-platforms-detail-extra.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(function () { return { send: mockSend }; }),
  GetPlatformApplicationAttributesCommand: vi.fn(),
  ListEndpointsByPlatformApplicationCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { GET } from "@/app/api/sns-platforms/detail/route";

beforeEach(() => { vi.clearAllMocks(); });

describe("GET /api/sns-platforms/detail", () => {
  it("returns 400 when arn or profile missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when profile missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?arn=arn:aws:sns:ap-southeast-1:111:app/GCM/App"));
    expect(res.status).toBe(400);
  });

  it("returns endpoints and attributes", async () => {
    mockSend
      .mockResolvedValueOnce({ Attributes: { Enabled: "true", PlatformCredential: "key" } })
      .mockResolvedValueOnce({
        Endpoints: [
          {
            EndpointArn: "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/App/abc123",
            Attributes: {
              Token: "a-very-long-token-that-exceeds-20-characters-long",
              Enabled: "true",
              CustomUserData: "user-123",
            },
          },
          {
            EndpointArn: "arn:endpoint/2",
            Attributes: {
              Token: "short", // < 20 chars, no truncation
              Enabled: "false",
            },
          },
        ],
        NextToken: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?profile=proj-prod&arn=arn:aws:sns:ap-southeast-1:111:app/GCM/App"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.attributes).toMatchObject({ Enabled: "true" });
    expect(data.endpoints).toHaveLength(2);
    // Long token should be truncated
    expect(data.endpoints[0].token).toContain("…");
    expect(data.endpoints[0].enabled).toBe(true);
    expect(data.endpoints[0].userData).toBe("user-123");
    // Short token not truncated
    expect(data.endpoints[1].token).toBe("short");
    expect(data.endpoints[1].enabled).toBe(false);
    expect(data.endpoints[1].userData).toBeUndefined();
  });

  it("handles pagination with NextToken", async () => {
    mockSend
      .mockResolvedValueOnce({ Attributes: {} })
      .mockResolvedValueOnce({
        Endpoints: [{ EndpointArn: "ep1", Attributes: { Token: "tok1", Enabled: "true" } }],
        NextToken: "page2",
      })
      .mockResolvedValueOnce({
        Endpoints: [{ EndpointArn: "ep2", Attributes: { Token: "tok2", Enabled: "false" } }],
        NextToken: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?profile=proj-prod&arn=arn:app"));
    const data = await res.json();
    expect(data.endpoints).toHaveLength(2);
  });

  it("returns 500 when SDK throws with Error instance", async () => {
    mockSend.mockRejectedValue(new Error("InvalidParameterException"));
    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?profile=proj-prod&arn=arn:app"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("InvalidParameterException");
  });

  it("returns 500 when SDK throws with non-Error", async () => {
    mockSend.mockRejectedValue("string error");
    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?profile=proj-prod&arn=arn:app"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Unknown error");
  });

  it("handles null Attributes and Endpoints", async () => {
    mockSend
      .mockResolvedValueOnce({ Attributes: undefined })
      .mockResolvedValueOnce({
        Endpoints: undefined,
        NextToken: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?profile=proj-prod&arn=arn:app"));
    const data = await res.json();
    expect(data.attributes).toEqual({});
    expect(data.endpoints).toHaveLength(0);
  });

  it("handles endpoints with null/undefined EndpointArn, Attributes, and Token", async () => {
    mockSend
      .mockResolvedValueOnce({ Attributes: {} })
      .mockResolvedValueOnce({
        Endpoints: [
          {
            EndpointArn: undefined, // null ARN
            Attributes: undefined, // null attributes (falls to {} )
          },
          {
            EndpointArn: "arn:ep/2",
            Attributes: {
              Token: undefined, // null Token → ""
              Enabled: "true",
            },
          },
        ],
        NextToken: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/sns-platforms/detail?profile=proj-prod&arn=arn:app"));
    const data = await res.json();
    expect(data.endpoints).toHaveLength(2);
    expect(data.endpoints[0].arn).toBe(""); // undefined EndpointArn → ""
    expect(data.endpoints[0].token).toBe(""); // undefined Attributes → {} → token = ""
    expect(data.endpoints[1].token).toBe(""); // undefined Token → ""
  });
});
