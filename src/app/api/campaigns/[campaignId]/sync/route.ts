import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { syncCampaign } from "@/lib/social/sync";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { campaignId } = await params;

    // Agency users (super admins / agency managers) can sync any client's
    // campaign; client managers stay scoped to their own team.
    const campaign = await prisma.campaign.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: campaignId }
        : { id: campaignId, teamId: session.user.teamId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Rate limit: once per hour
    if (campaign.lastSyncAt) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (campaign.lastSyncAt > hourAgo) {
        return NextResponse.json(
          { error: "Sync is rate limited to once per hour per campaign" },
          { status: 429 }
        );
      }
    }

    // Run sync (updates lastSyncAt internally)
    const result = await syncCampaign(campaignId);

    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}
