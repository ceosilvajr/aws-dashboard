// src/__tests__/api/cost-analysis.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cost-explorer", () => ({
  CostExplorerClient: vi.fn(function () { return { send: mockSend }; }),
  GetCostAndUsageCommand: vi.fn(),
  GetCostForecastCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/cost-analysis/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/cost-analysis", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cost-analysis"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns cost data with correct shape", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "150.50" } } },
            { Keys: ["Amazon S3"], Metrics: { UnblendedCost: { Amount: "5.25" } } },
            { Keys: ["AWS Lambda"], Metrics: { UnblendedCost: { Amount: "0.001" } } }, // Below threshold
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: "50.00" } }); // forecast

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      totalRunningCost: expect.any(String),
      daysElapsed: expect.any(Number),
      daysInMonth: expect.any(Number),
      services: expect.any(Array),
      suggestions: expect.any(Array),
    });
  });

  it("includes suggestions for known services", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "100.00" } } },
            { Keys: ["Amazon RDS"], Metrics: { UnblendedCost: { Amount: "80.00" } } },
            { Keys: ["Amazon S3"], Metrics: { UnblendedCost: { Amount: "30.00" } } },
            { Keys: ["Amazon CloudFront"], Metrics: { UnblendedCost: { Amount: "20.00" } } },
            { Keys: ["AWS Lambda"], Metrics: { UnblendedCost: { Amount: "10.00" } } },
            { Keys: ["Amazon DynamoDB"], Metrics: { UnblendedCost: { Amount: "5.00" } } },
            { Keys: ["Elastic Load Balancing"], Metrics: { UnblendedCost: { Amount: "5.00" } } },
            { Keys: ["Amazon ECS"], Metrics: { UnblendedCost: { Amount: "5.00" } } },
            { Keys: ["AWS NAT Gateway"], Metrics: { UnblendedCost: { Amount: "5.00" } } },
            { Keys: ["AWS Secrets Manager"], Metrics: { UnblendedCost: { Amount: "5.00" } } },
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: "0.00" } });

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions.length).toBeGreaterThan(0);
  });

  it("handles forecast error gracefully (forecastTotal remains null)", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "100.00" } } },
          ],
        }],
      })
      .mockRejectedValueOnce(new Error("DataUnavailableException")); // forecast fails

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.forecastedCost).toBeNull();
  });

  it("handles services with elastic compute and fargate in name", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon Elastic Compute Cloud"], Metrics: { UnblendedCost: { Amount: "50.00" } } },
            { Keys: ["AWS Fargate"], Metrics: { UnblendedCost: { Amount: "30.00" } } },
            { Keys: ["Elastic Load Balancing (ELB)"], Metrics: { UnblendedCost: { Amount: "10.00" } } },
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: "20.00" } });

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions.length).toBeGreaterThan(0);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles null ResultsByTime response", async () => {
    mockSend
      .mockResolvedValueOnce({ ResultsByTime: undefined })
      .mockResolvedValueOnce({ Total: { Amount: "0.00" } });

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalRunningCost).toBe("0.00");
    expect(data.services).toEqual([]);
  });

  it("handles forecast with null Total amount", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "100.00" } } },
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: undefined } }); // null amount

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // When Total.Amount is undefined, parseFloat("0") = 0, so forecastedCost = totalRunning + 0
    expect(parseFloat(data.forecastedCost)).toBeGreaterThanOrEqual(100);
  });

  it("handles forecast with null Total object", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "50.00" } } },
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: undefined }); // null Total → Amount ?? "0"

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(parseFloat(data.forecastedCost)).toBeGreaterThanOrEqual(50);
  });

  it("handles day 1 of month (daysElapsed defaults to 1, no forecast)", async () => {
    // Set system time to 1st of month
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));

    mockSend.mockResolvedValueOnce({
      ResultsByTime: [{
        Groups: [
          { Keys: ["Amazon EC2"], Metrics: { UnblendedCost: { Amount: "31.00" } } },
        ],
      }],
    });
    // No forecast mock because day 1 skips forecast

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.daysElapsed).toBe(1); // 0 || 1 = 1
    expect(data.forecastedCost).toBeNull(); // no forecast on day 1

    vi.useRealTimers();
  });

  it("handles groups with null metrics", async () => {
    mockSend
      .mockResolvedValueOnce({
        ResultsByTime: [{
          Groups: [
            { Keys: undefined, Metrics: undefined }, // null keys/metrics
            { Keys: ["Service A"], Metrics: { UnblendedCost: { Amount: undefined } } }, // null amount
          ],
        }],
      })
      .mockResolvedValueOnce({ Total: { Amount: "0.00" } });

    const res = await GET(new NextRequest("http://localhost/api/cost-analysis?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    // Services with 0 cost are filtered out
    expect(data.services).toHaveLength(0);
  });
});
