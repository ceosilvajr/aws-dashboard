// src/__tests__/api/overview.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send: mockSend }; }),
  ListBucketsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(function () { return { send: mockSend }; }),
  ListTablesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-ecr", () => ({
  ECRClient: vi.fn(function () { return { send: mockSend }; }),
  DescribeRepositoriesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-cloudfront", () => ({
  CloudFrontClient: vi.fn(function () { return { send: mockSend }; }),
  ListDistributionsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn(function () { return { send: mockSend }; }),
  ListFunctionsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-cloudformation", () => ({
  CloudFormationClient: vi.fn(function () { return { send: mockSend }; }),
  ListStacksCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-cost-explorer", () => ({
  CostExplorerClient: vi.fn(function () { return { send: mockSend }; }),
  GetCostAndUsageCommand: vi.fn(),
  GetCostForecastCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/overview/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/overview", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/overview"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/overview?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns overview data with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: "bucket1" }, { Name: "bucket2" }] }) // S3
      .mockResolvedValueOnce({ TableNames: ["table1"] }) // DynamoDB
      .mockResolvedValueOnce({ repositories: [{ repositoryName: "repo1" }] }) // ECR
      .mockResolvedValueOnce({ DistributionList: { Quantity: 1 } }) // CloudFront
      .mockResolvedValueOnce({ Functions: [{ FunctionName: "fn1" }] }) // Lambda
      .mockResolvedValueOnce({ StackSummaries: [{ StackName: "my-stack" }] }) // CloudFormation
      .mockResolvedValueOnce({ // Cost
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "50.00" } } },
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: "25.00" } }); // Forecast

    const res = await GET(new NextRequest("http://localhost/api/overview?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      account: "proj-prod",
      s3Buckets: 2,
      dynamoTables: 1,
      ecrRepos: 1,
      cloudFrontDistributions: 1,
      lambdaFunctions: 1,
      cfnStacks: 1,
    });
    expect(data.fetchedAt).toBeDefined();
  });

  it("handles service errors gracefully (safeCount returns null)", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));

    const res = await GET(new NextRequest("http://localhost/api/overview?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.s3Buckets).toBeNull();
    expect(data.dynamoTables).toBeNull();
  });

  it("handles cost forecast failure gracefully", async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [] }) // S3
      .mockResolvedValueOnce({ TableNames: [] }) // DynamoDB
      .mockResolvedValueOnce({ repositories: [] }) // ECR
      .mockResolvedValueOnce({ DistributionList: { Quantity: 0 } }) // CloudFront
      .mockResolvedValueOnce({ Functions: [] }) // Lambda
      .mockResolvedValueOnce({ StackSummaries: [] }) // CloudFormation
      .mockResolvedValueOnce({ // Cost - no groups
        ResultsByTime: [{ Groups: [] }],
      })
      .mockRejectedValueOnce(new Error("DataUnavailableException")); // Forecast fails

    const res = await GET(new NextRequest("http://localhost/api/overview?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.forecastedCost).toBeNull();
    expect(data.monthlyCost).toBe("0.00");
  });

  it("handles when date is 1st of month (no forecast)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));

    mockSend
      .mockResolvedValueOnce({ Buckets: [] })
      .mockResolvedValueOnce({ TableNames: [] })
      .mockResolvedValueOnce({ repositories: [] })
      .mockResolvedValueOnce({ DistributionList: { Quantity: 0 } })
      .mockResolvedValueOnce({ Functions: [] })
      .mockResolvedValueOnce({ StackSummaries: [] })
      .mockResolvedValueOnce({ ResultsByTime: [{ Groups: [] }] });
    // No forecast mock because date is 1

    const res = await GET(new NextRequest("http://localhost/api/overview?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.forecastedCost).toBeNull();

    vi.useRealTimers();
  });

  it("handles when date is 1st of month via real date check (cost data processed)", async () => {
    // Test the cost data path with top services
    mockSend
      .mockResolvedValueOnce({ Buckets: [] })
      .mockResolvedValueOnce({ TableNames: [] })
      .mockResolvedValueOnce({ repositories: [] })
      .mockResolvedValueOnce({ DistributionList: { Quantity: 0 } })
      .mockResolvedValueOnce({ Functions: [] })
      .mockResolvedValueOnce({ StackSummaries: [] })
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "100.00" } } },
            { Keys: ["Amazon S3"], Metrics: { UnblendedCost: { Amount: "50.00" } } },
            { Keys: ["Amazon RDS"], Metrics: { UnblendedCost: { Amount: "30.00" } } },
            { Keys: ["Amazon Lambda"], Metrics: { UnblendedCost: { Amount: "20.00" } } },
            { Keys: ["Amazon ECS"], Metrics: { UnblendedCost: { Amount: "10.00" } } },
            { Keys: ["Amazon ECR"], Metrics: { UnblendedCost: { Amount: "5.00" } } },
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: "30.00" } }); // forecast

    const res = await GET(new NextRequest("http://localhost/api/overview?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.topServices).toHaveLength(5); // max 5 returned
    expect(data.monthlyCost).toBeDefined();
  });

  it("handles null/undefined responses from all services", async () => {
    // All services return null or minimal responses
    mockSend
      .mockResolvedValueOnce({ Buckets: undefined }) // S3 Buckets null
      .mockResolvedValueOnce({ TableNames: undefined }) // DynamoDB
      .mockResolvedValueOnce({ repositories: undefined }) // ECR
      .mockResolvedValueOnce({ DistributionList: { Quantity: undefined } }) // CloudFront
      .mockResolvedValueOnce({ Functions: undefined }) // Lambda
      .mockResolvedValueOnce({ StackSummaries: undefined }) // CloudFormation
      .mockResolvedValueOnce({ ResultsByTime: undefined }); // Cost

    const res = await GET(new NextRequest("http://localhost/api/overview?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.s3Buckets).toBe(0); // undefined ?? 0
    expect(data.dynamoTables).toBe(0);
    expect(data.cloudFrontDistributions).toBe(0);
  });
});
