// src/__tests__/api/sns-platforms-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(function () { return { send: mockSend }; }),
  GetPlatformApplicationAttributesCommand: vi.fn(),
  ListEndpointsByPlatformApplicationCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));

import { GET } from "@/app/api/sns-platforms/detail/route";

const PLATFORM_ARN = "arn:aws:sns:ap-southeast-1:111:app/GCM/MyApp";
const ENDPOINT_ARN = "arn:aws:sns:ap-southeast-1:111:endpoint/GCM/MyApp/abc123";

function makeRequest(params: string) {
  return new NextRequest(`http://localhost/api/sns-platforms/detail${params}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend
    .mockResolvedValueOnce({ Attributes: { Enabled: "true", SuccessFeedbackRoleArn: "arn:aws:iam::111:role/SNSFeedback" } })
    .mockResolvedValueOnce({
      Endpoints: [{ EndpointArn: ENDPOINT_ARN, Attributes: { Token: "a".repeat(200), Enabled: "true" } }],
      NextToken: undefined,
    });
});

describe("GET /api/sns-platforms/detail", () => {
  it("returns platform attributes and endpoints", async () => {
    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    const data = await res.json();

    expect(data.attributes).toMatchObject({ Enabled: "true" });
    expect(data.endpoints).toHaveLength(1);
    expect(data.endpoints[0].enabled).toBe(true);
    expect(data.endpoints[0].arn).toBe(ENDPOINT_ARN);
  });

  it("truncates long device tokens", async () => {
    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    const data = await res.json();

    const token = data.endpoints[0].token as string;
    expect(token).toContain("…");
    expect(token.length).toBeLessThan(30);
  });

  it("returns 400 when arn is missing", async () => {
    const res = await GET(makeRequest("?profile=proj-prod"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 when profile is missing", async () => {
    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}`));
    expect(res.status).toBe(400);
  });

  it("returns 500 with error message when SDK throws", async () => {
    mockSend.mockReset();
    mockSend.mockRejectedValue(new Error("ResourceNotFound"));

    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("ResourceNotFound");
  });

  it("paginates through endpoint pages", async () => {
    mockSend.mockReset();
    mockSend
      .mockResolvedValueOnce({ Attributes: { Enabled: "true" } })
      .mockResolvedValueOnce({ Endpoints: [{ EndpointArn: ENDPOINT_ARN, Attributes: { Token: "tok1", Enabled: "true" } }], NextToken: "page2" })
      .mockResolvedValueOnce({ Endpoints: [{ EndpointArn: ENDPOINT_ARN + "2", Attributes: { Token: "tok2", Enabled: "false" } }], NextToken: undefined });

    const res = await GET(makeRequest(`?arn=${encodeURIComponent(PLATFORM_ARN)}&profile=proj-prod`));
    const data = await res.json();

    expect(data.endpoints).toHaveLength(2);
    expect(data.endpoints[1].enabled).toBe(false);
  });
});
