// src/__tests__/proxy.test.ts
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(host: string, origin?: string): NextRequest {
  const req = new NextRequest("http://localhost/api/test");
  const headers = new Headers();
  headers.set("host", host);
  if (origin !== undefined) headers.set("origin", origin);
  // NextRequest doesn't allow modifying headers after creation,
  // so we create a new one with the correct headers
  return new NextRequest("http://localhost/api/test", { headers });
}

describe("proxy", () => {
  it("allows requests from localhost", () => {
    const req = makeRequest("localhost");
    const res = proxy(req);
    expect(res.status).not.toBe(403);
  });

  it("allows requests from localhost:3000", () => {
    const req = makeRequest("localhost:3000");
    const res = proxy(req);
    expect(res.status).not.toBe(403);
  });

  it("allows requests from 127.0.0.1", () => {
    const req = makeRequest("127.0.0.1");
    const res = proxy(req);
    expect(res.status).not.toBe(403);
  });

  it("allows requests from 127.0.0.1:3000", () => {
    const req = makeRequest("127.0.0.1:3000");
    const res = proxy(req);
    expect(res.status).not.toBe(403);
  });

  it("blocks requests from non-local hosts", () => {
    const req = makeRequest("evil.example.com");
    const res = proxy(req);
    expect(res.status).toBe(403);
  });

  it("allows requests with no origin header", () => {
    const req = makeRequest("localhost");
    const res = proxy(req);
    expect(res.status).not.toBe(403);
  });

  it("allows requests with safe origin", () => {
    const req = makeRequest("localhost:3000", "http://localhost:3000");
    const res = proxy(req);
    expect(res.status).not.toBe(403);
  });

  it("blocks requests with non-local origin", () => {
    const req = makeRequest("localhost:3000", "https://evil.example.com");
    const res = proxy(req);
    expect(res.status).toBe(403);
  });

  it("blocks requests with invalid origin URL", () => {
    const req = makeRequest("localhost:3000", "not-a-valid-url");
    const res = proxy(req);
    expect(res.status).toBe(403);
  });
});
