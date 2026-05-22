import { parseAwsConfig, getGroups } from "@/lib/aws-config-parser";
import { NextResponse } from "next/server";

export async function GET() {
  const accounts = await parseAwsConfig();
  return NextResponse.json({ accounts, groups: getGroups(accounts) });
}
