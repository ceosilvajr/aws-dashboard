import { NextRequest, NextResponse } from "next/server";
import { CloudFormationClient, ListStacksCommand } from "@aws-sdk/client-cloudformation";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

const ACTIVE_STATUSES = [
  "CREATE_COMPLETE", "CREATE_IN_PROGRESS", "CREATE_FAILED",
  "UPDATE_COMPLETE", "UPDATE_IN_PROGRESS", "UPDATE_ROLLBACK_COMPLETE",
  "UPDATE_ROLLBACK_IN_PROGRESS", "UPDATE_ROLLBACK_FAILED",
  "ROLLBACK_COMPLETE", "ROLLBACK_IN_PROGRESS", "ROLLBACK_FAILED",
  "IMPORT_COMPLETE", "IMPORT_IN_PROGRESS", "IMPORT_ROLLBACK_COMPLETE",
] as const;

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const cfn = createClient(CloudFormationClient, profile, getRegion(request));
    const res = await cfn.send(new ListStacksCommand({
      StackStatusFilter: [...ACTIVE_STATUSES],
    }));

    const stacks = (res.StackSummaries ?? []).map((s) => ({
      name: s.StackName ?? "",
      status: s.StackStatus ?? "",
      created: s.CreationTime?.toISOString() ?? "",
      updated: s.LastUpdatedTime?.toISOString() ?? "",
      description: s.TemplateDescription ?? "",
    }));

    return NextResponse.json({ stacks });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
