// src/__tests__/api/ecs-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-ecs", () => ({
  ECSClient: vi.fn(function () { return { send: mockSend }; }),
  DescribeServicesCommand: vi.fn(),
  DescribeTaskDefinitionCommand: vi.fn(),
  ListTasksCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/ecs/detail/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/ecs/detail", () => {
  it("returns 400 when required params missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecs/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when cluster missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecs/detail?profile=proj-prod&service=my-service"));
    expect(res.status).toBe(400);
  });

  it("returns service detail with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          desiredCount: 2,
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: "256",
          memory: "512",
          containerDefinitions: [{
            name: "app",
            environment: [{ name: "APP_ENV", value: "production" }],
          }],
        },
      })
      .mockResolvedValueOnce({
        taskArns: ["arn:aws:ecs:ap-southeast-1:111:task/abc123", "arn:aws:ecs:ap-southeast-1:111:task/def456"],
      });

    const res = await GET(new NextRequest("http://localhost/api/ecs/detail?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      service: "my-service",
      cluster: "my-cluster",
      cpu: "256",
      memory: "512",
      desiredCount: 2,
      runningCount: 2,
    });
    expect(data.envVars).toHaveLength(1);
    expect(data.envVars[0]).toMatchObject({ name: "APP_ENV", value: "production" });
  });

  it("returns 404 when service not found", async () => {
    mockSend.mockResolvedValueOnce({ services: [] });
    const res = await GET(new NextRequest("http://localhost/api/ecs/detail?profile=proj-prod&cluster=my-cluster&service=missing-service"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("ClusterNotFoundException"));
    const res = await GET(new NextRequest("http://localhost/api/ecs/detail?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(500);
  });

  it("handles service with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        services: [{
          serviceName: undefined,
          desiredCount: undefined,
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: undefined,
          memory: undefined,
          containerDefinitions: [{
            name: undefined,
            environment: undefined, // null environment
          }],
        },
      })
      .mockResolvedValueOnce({
        taskArns: undefined, // null taskArns
      });

    const res = await GET(new NextRequest("http://localhost/api/ecs/detail?profile=proj-prod&cluster=my-cluster&service=my-service"));
    const data = await res.json();
    expect(data.service).toBeUndefined(); // svc.serviceName is undefined
    expect(data.desiredCount).toBe(0); // undefined ?? 0
    expect(data.cpu).toBe("0"); // undefined ?? "0"
    expect(data.memory).toBe("0");
    expect(data.runningCount).toBe(0); // undefined ?? 0
    expect(data.envVars).toHaveLength(0); // null environment = []
  });
});
