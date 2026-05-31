// src/__tests__/api/lambda-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn(function () { return { send: mockSend }; }),
  GetFunctionCommand: vi.fn(),
  GetFunctionConcurrencyCommand: vi.fn(),
  ListEventSourceMappingsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/lambda/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/lambda/detail", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/lambda/detail?name=my-function"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when name missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/lambda/detail?profile=proj-prod"));
    expect(res.status).toBe(400);
  });

  it("returns function detail with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        Configuration: {
          FunctionName: "my-function",
          FunctionArn: "arn:aws:lambda:ap-southeast-1:111:function:my-function",
          Runtime: "nodejs18.x",
          Handler: "index.handler",
          Role: "arn:aws:iam::111:role/lambda-role",
          CodeSize: 1024,
          Description: "My Lambda function",
          LastModified: "2024-01-01T00:00:00.000+0000",
          State: "Active",
          StateReason: "",
          LastUpdateStatus: "Successful",
          LastUpdateStatusReason: "",
          MemorySize: 128,
          Timeout: 30,
          EphemeralStorage: { Size: 512 },
          VpcConfig: { VpcId: "vpc-123", SubnetIds: ["subnet-1"], SecurityGroupIds: ["sg-1"] },
          Environment: { Variables: { ENV: "prod" } },
          Layers: [{ Arn: "arn:aws:lambda:ap-southeast-1:111:layer:my-layer:1" }],
          Architectures: ["x86_64"],
        },
      })
      .mockResolvedValueOnce({ ReservedConcurrentExecutions: 100 })
      .mockResolvedValueOnce({
        EventSourceMappings: [{
          EventSourceArn: "arn:aws:sqs:ap-southeast-1:111:my-queue",
          State: "Enabled",
          BatchSize: 10,
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/lambda/detail?profile=proj-prod&name=my-function"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      name: "my-function",
      runtime: "nodejs18.x",
      handler: "index.handler",
      memorySize: 128,
      timeout: 30,
      vpcId: "vpc-123",
      reservedConcurrency: 100,
      envVarCount: 1,
    });
    expect(data.layers).toHaveLength(1);
    expect(data.eventSources).toHaveLength(1);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("ResourceNotFoundException"));
    const res = await GET(new NextRequest("http://localhost/api/lambda/detail?profile=proj-prod&name=missing-function"));
    expect(res.status).toBe(500);
  });

  it("handles function without VPC config", async () => {
    mockSend
      .mockResolvedValueOnce({
        Configuration: {
          FunctionName: "simple-function",
          FunctionArn: "arn:aws:lambda:ap-southeast-1:111:function:simple-function",
          Runtime: "python3.11",
          Handler: "handler.main",
          Role: "arn:aws:iam::111:role/lambda-role",
          CodeSize: 512,
          Description: "",
          LastModified: "2024-01-01T00:00:00.000+0000",
          State: "Active",
          MemorySize: 256,
          Timeout: 60,
          // No VpcConfig, no Layers, no Architectures, no EphemeralStorage, no Environment
        },
      })
      .mockResolvedValueOnce({ ReservedConcurrentExecutions: undefined })
      .mockResolvedValueOnce({ EventSourceMappings: [] });

    const res = await GET(new NextRequest("http://localhost/api/lambda/detail?profile=proj-prod&name=simple-function"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.vpcId).toBe("");
    expect(data.subnetIds).toEqual([]);
    expect(data.securityGroupIds).toEqual([]);
    expect(data.layers).toEqual([]);
    expect(data.architectures).toEqual([]);
    expect(data.reservedConcurrency).toBeNull();
    expect(data.envVarCount).toBe(0);
    expect(data.ephemeralStorage).toBe(512); // default
  });

  it("handles event sources with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        Configuration: {
          FunctionName: "fn",
          MemorySize: 128,
          Timeout: 30,
          EphemeralStorage: { Size: 512 },
        },
      })
      .mockResolvedValueOnce({ ReservedConcurrentExecutions: 50 })
      .mockResolvedValueOnce({
        EventSourceMappings: [
          { EventSourceArn: undefined, State: undefined, BatchSize: undefined }, // null fields
          { EventSourceArn: "arn:sqs:queue", State: "Enabled", BatchSize: 10 }, // valid
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/lambda/detail?profile=proj-prod&name=fn"));
    const data = await res.json();
    expect(data.eventSources).toHaveLength(2);
    expect(data.eventSources[0].source).toBe("");
    expect(data.eventSources[0].state).toBe("");
    expect(data.eventSources[0].batchSize).toBe(0);
    expect(data.reservedConcurrency).toBe(50);
  });
});
