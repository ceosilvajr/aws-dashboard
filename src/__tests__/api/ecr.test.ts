// src/__tests__/api/ecr.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-ecr", () => ({
  ECRClient: vi.fn(function () { return { send: mockSend }; }),
  DescribeRepositoriesCommand: vi.fn(),
  DescribeImagesCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({ fromIni: vi.fn(() => ({})) }));
vi.mock("@/lib/accounts", () => ({ getAccounts: vi.fn(), REGION: "ap-southeast-1" }));
vi.mock("@/lib/constants", () => ({ getRegion: vi.fn(() => "ap-southeast-1"), REGION: "ap-southeast-1" }));

import { getAccounts } from "@/lib/accounts";
import { GET } from "@/app/api/ecr/route";

const MOCK_ACCOUNTS = [
  { id: "111", name: "proj-prod", profile: "proj-prod", group: "proj" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccounts).mockResolvedValue(MOCK_ACCOUNTS);
});

describe("GET /api/ecr", () => {
  it("returns 400 when no profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecr"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when unknown profile given", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=unknown"));
    expect(res.status).toBe(400);
  });

  it("returns repositories with correct shape", async () => {
    const pushedAt = new Date("2024-06-01");
    mockSend
      .mockResolvedValueOnce({
        repositories: [{
          repositoryName: "my-repo",
          repositoryUri: "111.dkr.ecr.ap-southeast-1.amazonaws.com/my-repo",
          createdAt: new Date("2023-01-01"),
          imageScanningConfiguration: { scanOnPush: true },
          imageTagMutability: "IMMUTABLE",
        }],
      })
      .mockResolvedValueOnce({
        imageDetails: [{
          imageTags: ["v1.0.0"],
          imagePushedAt: pushedAt,
          imageSizeInBytes: 1024 * 1024 * 100, // 100 MB
        }],
      });

    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.repositories).toHaveLength(1);
    expect(data.repositories[0]).toMatchObject({
      name: "my-repo",
      uri: "111.dkr.ecr.ap-southeast-1.amazonaws.com/my-repo",
      scanOnPush: true,
      tagMutability: "IMMUTABLE",
      latestTag: "v1.0.0",
      imageCount: 1,
      sizeMB: 100,
    });
  });

  it("returns 500 when SDK throws", async () => {
    mockSend.mockRejectedValue(new Error("AccessDenied"));
    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=proj-prod"));
    expect(res.status).toBe(500);
  });

  it("handles missing image details gracefully", async () => {
    mockSend
      .mockResolvedValueOnce({
        repositories: [{
          repositoryName: "empty-repo",
          repositoryUri: "111.dkr.ecr.ap-southeast-1.amazonaws.com/empty-repo",
          createdAt: new Date("2023-01-01"),
          imageScanningConfiguration: { scanOnPush: false },
          imageTagMutability: "MUTABLE",
        }],
      })
      .mockRejectedValueOnce(new Error("RepositoryNotFoundException"));

    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=proj-prod"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.repositories).toHaveLength(1);
    expect(data.repositories[0].latestTag).toBe("");
    expect(data.repositories[0].imageCount).toBe(0);
  });

  it("handles images with no tags (untagged)", async () => {
    const date = new Date("2024-01-01");
    mockSend
      .mockResolvedValueOnce({
        repositories: [{
          repositoryName: "my-repo",
          repositoryUri: "111.dkr.ecr.ap-southeast-1.amazonaws.com/my-repo",
          createdAt: new Date("2023-01-01"),
          imageScanningConfiguration: { scanOnPush: false },
          imageTagMutability: "MUTABLE",
        }],
      })
      .mockResolvedValueOnce({
        imageDetails: [
          { imageTags: undefined, imagePushedAt: date, imageSizeInBytes: 512 }, // no tags
          { imageTags: [], imagePushedAt: undefined, imageSizeInBytes: 256 }, // no pushed date (filtered)
        ],
      });

    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=proj-prod"));
    const data = await res.json();
    expect(data.repositories[0].latestTag).toBe("untagged"); // undefined tags
    expect(data.repositories[0].imageCount).toBe(2);
  });

  it("handles empty repositories list", async () => {
    mockSend.mockResolvedValueOnce({ repositories: [] });
    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=proj-prod"));
    const data = await res.json();
    expect(data.repositories).toHaveLength(0);
  });

  it("handles repositories with null/undefined fields", async () => {
    mockSend
      .mockResolvedValueOnce({
        repositories: [{
          repositoryName: undefined,
          repositoryUri: undefined,
          createdAt: undefined,
          imageScanningConfiguration: undefined,
          imageTagMutability: undefined,
        }],
      })
      .mockResolvedValueOnce({ imageDetails: [] });

    const res = await GET(new NextRequest("http://localhost/api/ecr?profile=proj-prod"));
    const data = await res.json();
    expect(data.repositories[0].name).toBe("");
    expect(data.repositories[0].uri).toBe("");
    expect(data.repositories[0].created).toBe("");
    expect(data.repositories[0].scanOnPush).toBe(false);
    expect(data.repositories[0].tagMutability).toBe("");
    expect(data.repositories[0].imageCount).toBe(0);
  });
});
