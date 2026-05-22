import { NextRequest, NextResponse } from "next/server";

const SAFE_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

function hostIsSafe(value: string): boolean {
  return SAFE_HOST.test(value);
}

function originIsSafe(value: string | null): boolean {
  if (!value) return true;
  try {
    return SAFE_HOST.test(new URL(value).host);
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (!hostIsSafe(host)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (!originIsSafe(origin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
