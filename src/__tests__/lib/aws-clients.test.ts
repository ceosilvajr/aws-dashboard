// src/__tests__/lib/aws-clients.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/credential-providers", () => ({
  fromIni: vi.fn(() => ({ type: "mock-credentials" })),
}));

describe("createClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("constructs a client with the given profile and default region", async () => {
    const { createClient } = await import("@/lib/aws-clients");

    class FakeClient {
      config: unknown;
      constructor(config: unknown) { this.config = config; }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createClient(FakeClient as any, "my-profile");

    expect(client).toBeInstanceOf(FakeClient);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).config.region).toBe("ap-southeast-1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).config.credentials).toBeDefined();
  });

  it("accepts an explicit region override", async () => {
    const { createClient } = await import("@/lib/aws-clients");

    class FakeClient {
      config: unknown;
      constructor(config: unknown) { this.config = config; }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = createClient(FakeClient as any, "my-profile", "us-east-1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).config.region).toBe("us-east-1");
  });
});
