export const REGION: string = process.env.AWS_DASHBOARD_REGION ?? process.env.AWS_REGION ?? "ap-southeast-1";

import type { NextRequest } from "next/server";

/** Read region from `?region=` query param, falling back to the server-side default. */
export function getRegion(request: NextRequest): string {
  return request.nextUrl.searchParams.get("region") ?? REGION;
}
