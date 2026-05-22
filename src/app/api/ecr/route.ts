import { NextRequest, NextResponse } from "next/server";
import { ECRClient, DescribeRepositoriesCommand, DescribeImagesCommand } from "@aws-sdk/client-ecr";
import { createClient } from "@/lib/aws-clients";
import { getAccounts } from "@/lib/accounts";
import { getRegion } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile");
  if (!profile || !(await getAccounts()).find((a) => a.profile === profile)) {
    return NextResponse.json({ error: "valid profile required" }, { status: 400 });
  }

  try {
    const ecr = createClient(ECRClient, profile, getRegion(request));
    const { repositories = [] } = await ecr.send(new DescribeRepositoriesCommand({}));

    const repos = await Promise.all(
      repositories.map(async (repo) => {
        let latestTag = "";
        let latestPushed = "";
        let imageCount = 0;
        let sizeBytes = 0;

        try {
          const { imageDetails = [] } = await ecr.send(
            new DescribeImagesCommand({
              repositoryName: repo.repositoryName,
              filter: { tagStatus: "TAGGED" },
            })
          );
          imageCount = imageDetails.length;
          sizeBytes = imageDetails.reduce((sum, img) => sum + (img.imageSizeInBytes ?? 0), 0);

          const sorted = imageDetails
            .filter((img) => img.imagePushedAt)
            .sort((a, b) => (b.imagePushedAt!.getTime() - a.imagePushedAt!.getTime()));

          if (sorted.length > 0) {
            latestTag = sorted[0].imageTags?.[0] ?? "untagged";
            latestPushed = sorted[0].imagePushedAt?.toISOString() ?? "";
          }
        } catch { /* skip image details errors */ }

        return {
          name: repo.repositoryName ?? "",
          uri: repo.repositoryUri ?? "",
          created: repo.createdAt?.toISOString() ?? "",
          scanOnPush: repo.imageScanningConfiguration?.scanOnPush ?? false,
          tagMutability: repo.imageTagMutability ?? "",
          latestTag,
          latestPushed,
          imageCount,
          sizeMB: Math.round(sizeBytes / 1024 / 1024),
        };
      })
    );

    return NextResponse.json({ repositories: repos });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
