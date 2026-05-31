// src/__tests__/api/cognito-detail.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: vi.fn(function () { return { send: mockSend }; }),
  ListUsersCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { GET } from "@/app/api/cognito/detail/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cognito/detail", () => {
  it("returns 400 when required params missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cognito/detail"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when poolId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cognito/detail?profile=proj-prod"));
    expect(res.status).toBe(400);
  });

  it("returns user status counts", async () => {
    mockSend.mockResolvedValueOnce({
      Users: [
        { UserStatus: "CONFIRMED", UserCreateDate: new Date("2024-01-01") },
        { UserStatus: "CONFIRMED", UserCreateDate: new Date("2024-01-02") },
        { UserStatus: "UNCONFIRMED", UserCreateDate: new Date("2024-01-03") },
        { UserStatus: "FORCE_CHANGE_PASSWORD", UserCreateDate: new Date("2024-01-04") },
        { UserStatus: "UNKNOWN_STATUS", UserCreateDate: new Date("2024-01-05") }, // goes to UNKNOWN
      ],
      PaginationToken: undefined,
    });

    const res = await GET(new NextRequest("http://localhost/api/cognito/detail?profile=proj-prod&poolId=ap-southeast-1_abc123"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.CONFIRMED).toBe(2);
    expect(data.UNCONFIRMED).toBe(1);
    expect(data.FORCE_CHANGE_PASSWORD).toBe(1);
    expect(data.UNKNOWN).toBe(1);
    expect(data.total).toBe(5);
  });

  it("filters users by date range", async () => {
    const inRange = new Date("2025-06-15");
    mockSend.mockResolvedValueOnce({
      Users: [
        { UserStatus: "CONFIRMED", UserCreateDate: new Date("2020-01-01") }, // before from date
        { UserStatus: "CONFIRMED", UserCreateDate: inRange }, // within range
        { UserStatus: "CONFIRMED", UserCreateDate: new Date("2099-01-01") }, // after to date
      ],
      PaginationToken: undefined,
    });

    const from = new Date("2025-01-01").toISOString();
    const to = new Date("2025-12-31").toISOString();
    const res = await GET(new NextRequest(`http://localhost/api/cognito/detail?profile=proj-prod&poolId=ap-southeast-1_abc123&from=${from}&to=${to}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
  });

  it("handles pagination", async () => {
    mockSend
      .mockResolvedValueOnce({
        Users: [{ UserStatus: "CONFIRMED", UserCreateDate: new Date() }],
        PaginationToken: "page2",
      })
      .mockResolvedValueOnce({
        Users: [{ UserStatus: "CONFIRMED", UserCreateDate: new Date() }],
        PaginationToken: undefined,
      });

    const res = await GET(new NextRequest("http://localhost/api/cognito/detail?profile=proj-prod&poolId=ap-southeast-1_abc123"));
    const data = await res.json();
    expect(data.total).toBe(2);
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("ResourceNotFoundException"));
    const res = await GET(new NextRequest("http://localhost/api/cognito/detail?profile=proj-prod&poolId=bad-pool"));
    expect(res.status).toBe(500);
  });
});
