// src/__tests__/lib/aws-config-parser.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAwsConfig, getGroups, invalidateCache } from "@/lib/aws-config-parser";

const mockSend = vi.fn();

vi.mock("@smithy/shared-ini-file-loader", () => ({
  loadSharedConfigFiles: vi.fn(),
}));
vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: vi.fn(function () {
    return { send: mockSend };
  }),
  GetCallerIdentityCommand: vi.fn(),
}));
vi.mock("@aws-sdk/credential-providers", () => ({
  fromIni: vi.fn(() => ({})),
}));

import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";

const mockLoad = vi.mocked(loadSharedConfigFiles);

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCache();
});

describe("parseAwsConfig", () => {
  it("extracts account id from role_arn", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("123456789012");
    expect(accounts[0].name).toBe("myproject-prod");
    expect(accounts[0].profile).toBe("myproject-prod");
    expect(accounts[0].group).toBe("myproject");
  });

  it("extracts account id from sso_account_id", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-dev": { sso_account_id: "999888777666", sso_start_url: "https://example.awsapps.com/start" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("999888777666");
  });

  it("skips sso-session entries that have sso_start_url but no sso_account_id", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "sso-session my-sso": { sso_start_url: "https://example.awsapps.com/start" },
        "myproject-prod": { role_arn: "arn:aws:iam::111111111111:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].profile).toBe("myproject-prod");
  });

  it("falls back to STS GetCallerIdentity when no id in config", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-test": {},
      },
      credentialsFile: {},
    });
    mockSend.mockResolvedValue({ Account: "555444333222" });

    const accounts = await parseAwsConfig();

    expect(accounts[0].id).toBe("555444333222");
  });

  it("sets id to null when STS call fails", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "orphan-profile": {},
      },
      credentialsFile: {},
    });
    mockSend.mockRejectedValue(new Error("No credentials"));

    const accounts = await parseAwsConfig();

    expect(accounts[0].id).toBeNull();
  });

  it("returns cached result on second call without re-fetching", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    await parseAwsConfig();
    await parseAwsConfig();

    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("skips the default profile", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        default: { region: "us-east-1" },
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts.every((a) => a.profile !== "default")).toBe(true);
  });
});

describe("getGroups", () => {
  it("returns unique groups from account list", () => {
    const accounts = [
      { id: "1", name: "a-prod", profile: "a-prod", group: "a" },
      { id: "2", name: "a-dev", profile: "a-dev", group: "a" },
      { id: "3", name: "b-prod", profile: "b-prod", group: "b" },
    ];
    expect(getGroups(accounts)).toEqual(["a", "b"]);
  });

  it("returns empty array for empty account list", () => {
    expect(getGroups([])).toEqual([]);
  });
});

describe("invalidateCache", () => {
  it("forces re-fetch on next parseAwsConfig call", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        "myproject-prod": { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    await parseAwsConfig();
    invalidateCache();
    await parseAwsConfig();

    expect(mockLoad).toHaveBeenCalledTimes(2);
  });
});

describe("deriveGroup (via parseAwsConfig)", () => {
  it("uses full profile name as group when no hyphen present", async () => {
    mockLoad.mockResolvedValue({
      configFile: {
        standalone: { role_arn: "arn:aws:iam::123456789012:role/MyRole" },
      },
      credentialsFile: {},
    });

    const accounts = await parseAwsConfig();

    expect(accounts[0].group).toBe("standalone");
  });
});
