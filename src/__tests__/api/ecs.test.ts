// src/__tests__/api/ecs.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockEcsSend = vi.fn();
const mockElbSend = vi.fn();
const mockAasSend = vi.fn();

vi.mock("@aws-sdk/client-ecs", () => ({
  ECSClient: vi.fn(function () { return { send: mockEcsSend }; }),
  ListClustersCommand: vi.fn(),
  ListServicesCommand: vi.fn(),
  DescribeServicesCommand: vi.fn(),
  DescribeTaskDefinitionCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-elastic-load-balancing-v2", () => ({
  ElasticLoadBalancingV2Client: vi.fn(function () { return { send: mockElbSend }; }),
  DescribeTargetGroupsCommand: vi.fn(),
  DescribeListenersCommand: vi.fn(),
  DescribeRulesCommand: vi.fn(),
  DescribeLoadBalancersCommand: vi.fn(),
}));
vi.mock("@aws-sdk/client-application-auto-scaling", () => ({
  ApplicationAutoScalingClient: vi.fn(function () { return { send: mockAasSend }; }),
  DescribeScalableTargetsCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/ecs/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/ecs", () => {
  it("returns services with correct shape for specific profile", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 2,
          runningCount: 2,
          loadBalancers: [],
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: "256",
          memory: "512",
          containerDefinitions: [{
            name: "app",
            image: "111.dkr.ecr.ap-southeast-1.amazonaws.com/my-repo:v1.0.0",
            portMappings: [{ containerPort: 8080 }],
          }],
        },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.services).toHaveLength(1);
    expect(data.services[0]).toMatchObject({
      cluster: "my-cluster",
      service: "my-service",
      cpu: "256",
      memory: "512",
      desired: 2,
      running: 2,
      status: "healthy",
    });
    expect(data.fetchedAt).toBeDefined();
  });

  it("fans out across all accounts when no profile given", async () => {
    vi.mocked(getAccounts).mockResolvedValue([
      { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
      { id: "222", name: "proj-dev", profile: "proj-dev", group: "proj" },
    ]);
    mockEcsSend.mockResolvedValue({ clusterArns: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.services).toEqual([]);
  });

  it("returns empty services when SDK throws", async () => {
    mockEcsSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.services).toEqual([]);
  });

  it("returns unhealthy status when runningCount != desiredCount", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 3,
          runningCount: 1,
          loadBalancers: [],
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: "256",
          memory: "512",
          containerDefinitions: [{ name: "app", image: "my-image:latest" }],
        },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].status).toBe("unhealthy");
  });

  it("handles image without colon (no tag)", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [],
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: "256",
          memory: "512",
          containerDefinitions: [{ name: "app", image: "my-image-without-tag" }],
        },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].tag).toBe("latest");
  });

  it("handles services without task definition", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{ serviceName: "my-service", taskDefinition: undefined, desiredCount: 1, runningCount: 1, loadBalancers: [] }],
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    // Service without task definition is skipped
    expect(data.services).toHaveLength(0);
  });

  it("handles services with target groups and load balancers", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [{ targetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123" }],
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: "256",
          memory: "512",
          containerDefinitions: [{ name: "app", image: "111.dkr.ecr.ap-southeast-1.amazonaws.com/my-repo:v1.0.0", portMappings: [{ containerPort: 8080 }] }],
        },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [{ ResourceId: "service/my-cluster/my-service", MinCapacity: 2, MaxCapacity: 10 }] });

    mockElbSend
      .mockResolvedValueOnce({ TargetGroups: [{ TargetGroupName: "my-tg", TargetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123", Protocol: "HTTP", Port: 80, HealthCheckPath: "/health", LoadBalancerArns: ["arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc"] }] })
      .mockResolvedValueOnce({ LoadBalancers: [{ LoadBalancerName: "my-alb" }] })
      .mockResolvedValueOnce({ Listeners: [{ ListenerArn: "arn:listener/1", Protocol: "HTTP", Port: 80 }] })
      .mockResolvedValueOnce({ Rules: [{ Priority: "1", Actions: [{ Type: "forward", TargetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123" }], Conditions: [{ Field: "path-pattern", PathPatternConfig: { Values: ["/api/*"] } }] }] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].minCapacity).toBe(2);
    expect(data.services[0].maxCapacity).toBe(10);
    expect(data.services[0].targetGroups).toHaveLength(1);
  });

  it("handles host-header conditions and redirect actions", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [{ targetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123" }],
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    mockElbSend
      .mockResolvedValueOnce({ TargetGroups: [{ TargetGroupName: "my-tg", TargetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123", Protocol: "HTTP", Port: 80, HealthCheckPath: "", LoadBalancerArns: ["arn:aws:elasticloadbalancing:ap-southeast-1:111:loadbalancer/app/my-alb/abc"] }] })
      .mockResolvedValueOnce({ LoadBalancers: [{ LoadBalancerName: "my-alb" }] })
      .mockResolvedValueOnce({ Listeners: [{ ListenerArn: "arn:listener/1", Protocol: "HTTP", Port: 80 }] })
      .mockResolvedValueOnce({ Rules: [
        {
          Priority: "1",
          Actions: [{ Type: "redirect", TargetGroupArn: "arn:aws:elasticloadbalancing:ap-southeast-1:111:targetgroup/my-tg/123", RedirectConfig: { Protocol: "HTTPS", Port: "443" } }],
          Conditions: [
            { Field: "host-header", HostHeaderConfig: { Values: ["api.example.com"] } },
            { Field: "custom-field", Values: ["val1"] },
          ],
        },
      ] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].targetGroups[0].listeners[0].rules[0].conditions).toContain("Host: api.example.com");
  });

  it("handles empty cluster list gracefully", async () => {
    mockEcsSend.mockResolvedValueOnce({ clusterArns: [] });
    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services).toEqual([]);
  });

  it("handles scaling config errors gracefully", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{ serviceName: "my-service", taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1", desiredCount: 2, runningCount: 2, loadBalancers: [] }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockRejectedValueOnce(new Error("AccessDenied")); // scaling fails

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services).toHaveLength(1);
  });

  it("handles empty service list in cluster", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: [] });
    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });
    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services).toEqual([]);
  });

  it("handles target group errors gracefully", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{ serviceName: "my-service", taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1", desiredCount: 1, runningCount: 1, loadBalancers: [{ targetGroupArn: "arn:tg" }] }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });
    mockElbSend.mockRejectedValueOnce(new Error("TGNotFound")); // TG lookup fails

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services).toHaveLength(1);
    expect(data.services[0].targetGroups).toHaveLength(0);
  });

  it("handles target group with no load balancer ARNs", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{ serviceName: "my-service", taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1", desiredCount: 1, runningCount: 1, loadBalancers: [{ targetGroupArn: "arn:tg" }] }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    // TG has no load balancer ARNs
    mockElbSend.mockResolvedValueOnce({ TargetGroups: [{ TargetGroupName: "my-tg", TargetGroupArn: "arn:tg", Protocol: "HTTP", Port: 80, HealthCheckPath: "/health", LoadBalancerArns: [] }] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].targetGroups).toHaveLength(1);
    expect(data.services[0].targetGroups[0].albName).toBe("");
    expect(data.services[0].targetGroups[0].listeners).toHaveLength(0);
  });

  it("handles ALB describe failure in TG processing", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{ serviceName: "my-service", taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1", desiredCount: 1, runningCount: 1, loadBalancers: [{ targetGroupArn: "arn:tg" }] }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    // TG describe succeeds
    mockElbSend
      .mockResolvedValueOnce({ TargetGroups: [{ TargetGroupName: "my-tg", TargetGroupArn: "arn:tg", Protocol: "HTTP", Port: 80, HealthCheckPath: "/health", LoadBalancerArns: ["arn:alb"] }] })
      .mockRejectedValueOnce(new Error("ALBNotFound")) // ALB name lookup fails
      .mockRejectedValueOnce(new Error("ListenerNotFound")); // listener lookup fails

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].targetGroups[0].albName).toBe("");
    expect(data.services[0].targetGroups[0].listeners).toHaveLength(0);
  });

  it("handles rules with no matching target group", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{ serviceName: "my-service", taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1", desiredCount: 1, runningCount: 1, loadBalancers: [{ targetGroupArn: "arn:tg" }] }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    mockElbSend
      .mockResolvedValueOnce({ TargetGroups: [{ TargetGroupName: "my-tg", TargetGroupArn: "arn:tg", Protocol: "HTTP", Port: 80, HealthCheckPath: "", LoadBalancerArns: ["arn:alb"] }] })
      .mockResolvedValueOnce({ LoadBalancers: [{ LoadBalancerName: "my-alb" }] })
      .mockResolvedValueOnce({ Listeners: [{ ListenerArn: "arn:listener/1", Protocol: "HTTP", Port: 80 }] })
      .mockResolvedValueOnce({ Rules: [{ Priority: "1", Actions: [{ Type: "forward", TargetGroupArn: "arn:OTHER-TG" }], Conditions: [] }] }); // no matching rules

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    // No matching rules means no listeners added
    expect(data.services[0].targetGroups[0].listeners).toHaveLength(0);
  });

  it("handles null services response from ECS", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({ services: undefined }); // null services

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services).toEqual([]);
  });

  it("handles service with undefined serviceName and null container fields", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: undefined, // undefined service name
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 0, // zero desired
          runningCount: 0, // zero running
          loadBalancers: undefined, // null loadBalancers
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: undefined, // null cpu
          memory: undefined, // null memory
          containerDefinitions: [{
            name: undefined, // null container name
            image: undefined, // null image
            portMappings: undefined, // null port mappings
          }],
        },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services).toHaveLength(1);
    expect(data.services[0].service).toBe("");
    expect(data.services[0].container).toBe("");
    expect(data.services[0].cpu).toBe("0"); // undefined || "0"
    expect(data.services[0].memory).toBe("0");
    expect(data.services[0].port).toBe(0);
    expect(data.services[0].desired).toBe(0);
    expect(data.services[0].running).toBe(0);
    expect(data.services[0].status).toBe("healthy"); // 0 === 0
  });

  it("handles image that is single word (no slash)", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [],
        }],
      })
      .mockResolvedValueOnce({
        taskDefinition: {
          cpu: "512",
          memory: "1024",
          containerDefinitions: [{ name: "app", image: "nginx:latest" }], // single-word image with no /
        },
      });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].image).toBe("nginx"); // no slash, so fallback to imageRepo = "nginx"
  });

  it("handles loadBalancers with null targetGroupArn (filtered out)", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [
            { targetGroupArn: undefined }, // null tg - filtered out
            { targetGroupArn: "" }, // empty string - filtered out
          ],
        }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].targetGroups).toHaveLength(0); // all filtered out
  });

  it("handles formatConditions with empty conditions (returns 'default')", async () => {
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [{ targetGroupArn: "arn:tg" }],
        }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "256", memory: "512", containerDefinitions: [{ name: "app", image: "my-image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    mockElbSend
      .mockResolvedValueOnce({ TargetGroups: [{ TargetGroupName: "my-tg", TargetGroupArn: "arn:tg", Protocol: "HTTP", Port: 80, HealthCheckPath: "", LoadBalancerArns: ["arn:alb"] }] })
      .mockResolvedValueOnce({ LoadBalancers: [{ LoadBalancerName: "my-alb" }] })
      .mockResolvedValueOnce({ Listeners: [{ ListenerArn: "arn:listener/1", Protocol: "HTTP", Port: 80 }] })
      .mockResolvedValueOnce({ Rules: [
        // Rule with empty conditions (will return "default" from formatConditions)
        { Priority: "1", Actions: [{ Type: "forward", TargetGroupArn: "arn:tg" }], Conditions: [] },
      ] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].targetGroups[0].listeners[0].rules[0].conditions).toBe("default");
  });

  it("handles account with undefined id (id ?? empty string)", async () => {
    vi.mocked(getAccounts).mockResolvedValue([
      { name: "proj-prod", profile: "proj-prod", group: "proj" } as unknown as { id: string; name: string; profile: string; group: string },
    ]);
    mockEcsSend
      .mockResolvedValueOnce({ clusterArns: ["arn:aws:ecs:ap-southeast-1:111:cluster/my-cluster"] })
      .mockResolvedValueOnce({ serviceArns: ["arn:aws:ecs:ap-southeast-1:111:service/my-cluster/my-service"] })
      .mockResolvedValueOnce({
        services: [{
          serviceName: "my-service",
          taskDefinition: "arn:aws:ecs:ap-southeast-1:111:task-definition/my-td:1",
          desiredCount: 1,
          runningCount: 1,
          loadBalancers: [],
        }],
      })
      .mockResolvedValueOnce({ taskDefinition: { cpu: "512", memory: "1024", containerDefinitions: [{ name: "app", image: "my-repo/sub/image:v1" }] } });

    mockAasSend.mockResolvedValueOnce({ ScalableTargets: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecs?profile=proj-prod"));
    const data = await res.json();
    expect(data.services[0].accountId).toBe(""); // undefined ?? ""
    expect(data.services[0].image).toBe("sub/image"); // split by "/" and take from index 1
  });
});
