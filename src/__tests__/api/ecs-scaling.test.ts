// src/__tests__/api/ecs-scaling.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-application-auto-scaling", () => ({
  ApplicationAutoScalingClient: vi.fn(function () { return { send: mockSend }; }),
  DescribeScalableTargetsCommand: vi.fn(),
  DescribeScalingPoliciesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/ecs/scaling/route";

const MOCK_ACCOUNTS = [{ id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" }];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/ecs/scaling", () => {
  it("returns 400 when profile missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?cluster=c&service=s"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when cluster missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&service=s"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when service missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&cluster=c"));
    expect(res.status).toBe(400);
  });

  it("returns scaling data with target and predefined metric policy", async () => {
    mockSend
      .mockResolvedValueOnce({
        ScalableTargets: [{
          MinCapacity: 1,
          MaxCapacity: 10,
          SuspendedState: {
            DynamicScalingInSuspended: false,
            DynamicScalingOutSuspended: true,
            ScheduledScalingSuspended: false,
          },
        }],
      })
      .mockResolvedValueOnce({
        ScalingPolicies: [{
          PolicyName: "cpu-policy",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingScalingPolicyConfiguration: {
            PredefinedMetricSpecification: { PredefinedMetricType: "ECSServiceAverageCPUUtilization" },
            TargetValue: 70,
            ScaleInCooldown: 300,
            ScaleOutCooldown: 60,
          },
          StepScalingPolicyConfiguration: undefined,
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.minCapacity).toBe(1);
    expect(data.maxCapacity).toBe(10);
    expect(data.suspendedState).toMatchObject({ DynamicScalingOutSuspended: true });
    expect(data.policies).toHaveLength(1);
    expect(data.policies[0]).toMatchObject({
      name: "cpu-policy",
      type: "TargetTrackingScaling",
      metric: "ECSServiceAverageCPUUtilization",
      targetValue: 70,
      scaleInCooldown: 300,
      scaleOutCooldown: 60,
      stepAdjustments: [],
    });
  });

  it("returns scaling data with custom metric policy and no scalable target", async () => {
    mockSend
      .mockResolvedValueOnce({ ScalableTargets: [] })
      .mockResolvedValueOnce({
        ScalingPolicies: [{
          PolicyName: "custom-policy",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingScalingPolicyConfiguration: {
            CustomizedMetricSpecification: { MetricName: "MyCustomMetric" },
            TargetValue: 100,
            ScaleInCooldown: null,
            ScaleOutCooldown: null,
          },
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.minCapacity).toBeNull();
    expect(data.maxCapacity).toBeNull();
    expect(data.suspendedState).toBeNull();
    expect(data.policies[0].metric).toBe("MyCustomMetric");
    expect(data.policies[0].targetValue).toBe(100);
    expect(data.policies[0].scaleInCooldown).toBeNull();
  });

  it("returns step adjustments for step scaling policy", async () => {
    mockSend
      .mockResolvedValueOnce({ ScalableTargets: [] })
      .mockResolvedValueOnce({
        ScalingPolicies: [{
          PolicyName: "step-policy",
          PolicyType: "StepScaling",
          StepScalingPolicyConfiguration: {
            StepAdjustments: [
              { MetricIntervalLowerBound: 0, MetricIntervalUpperBound: 10, ScalingAdjustment: 1 },
              { MetricIntervalLowerBound: 10, MetricIntervalUpperBound: null, ScalingAdjustment: 2 },
            ],
          },
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.policies[0].stepAdjustments).toHaveLength(2);
    expect(data.policies[0].stepAdjustments[0]).toMatchObject({ lower: 0, upper: 10, adjustment: 1 });
    expect(data.policies[0].stepAdjustments[1]).toMatchObject({ lower: 10, upper: null, adjustment: 2 });
  });

  it("handles undefined ScalingPolicies gracefully", async () => {
    mockSend
      .mockResolvedValueOnce({ ScalableTargets: [] })
      .mockResolvedValueOnce({ ScalingPolicies: undefined });

    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.policies).toEqual([]);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/ecs/scaling?profile=proj-prod&cluster=my-cluster&service=my-service"));
    expect(res.status).toBe(500);
  });
});
