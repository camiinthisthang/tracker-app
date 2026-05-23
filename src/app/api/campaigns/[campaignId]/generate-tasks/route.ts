import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { generateTasksForCampaign } from "@/lib/tasks/generate";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { campaignId } = await params;

    // Agency users can generate tasks for any client's campaign.
    const campaign = await prisma.campaign.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: campaignId }
        : { id: campaignId, teamId: session.user.teamId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const result = await generateTasksForCampaign(campaignId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 }
    );
  }
}
