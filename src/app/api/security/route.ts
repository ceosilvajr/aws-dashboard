import { NextRequest, NextResponse } from "next/server";
import { CloudFormationClient, ListStacksCommand, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

// Returns stacks filtered by a keyword pattern
export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  const filter = request.nextUrl.searchParams.get("filter"); // e.g. "iam|waf|cognito|security"
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const cfn = createClient(CloudFormationClient, profile, getRegion(request));
    const res = await cfn.send(new ListStacksCommand({
      StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE"],
    }));

    let stacks = (res.StackSummaries ?? []).map((s) => ({
      name: s.StackName ?? "",
      status: s.StackStatus ?? "",
      created: s.CreationTime?.toISOString() ?? "",
      updated: s.LastUpdatedTime?.toISOString() ?? "",
      description: s.TemplateDescription ?? "",
    }));

    if (filter) {
      const patterns = filter.split("|").map((p) => p.toLowerCase());
      stacks = stacks.filter((s) => patterns.some((p) => s.name.toLowerCase().includes(p)));
    }

    return NextResponse.json({ stacks });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
