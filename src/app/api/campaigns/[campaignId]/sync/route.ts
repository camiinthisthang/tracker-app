import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { syncCampaign, SYNC_FETCH_BUDGET_MS } from "@/lib/social/sync";

// syncCampaign fans out Apify scrapes for every (creator, platform) on the
// campaign — a real-world 10-creator campaign can easily take 2–4 minutes.
// We respond to the client immediately and let the work continue via after();
// 300s is Vercel Pro's max function duration ceiling.
export const maxDuration = 300;

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

    // Rate limit: once per hour. Stamp lastSyncAt up-front so a second click
    // while the background job is still running is rejected — otherwise the
    // user could fan out N parallel scrapes by spamming the button.
    if (campaign.lastSyncAt) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (campaign.lastSyncAt > hourAgo) {
        return NextResponse.json(
          { error: "Sync is rate limited to once per hour per campaign" },
          { status: 429 }
        );
      }
    }
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { lastSyncAt: new Date() },
    });

    // Hand off to the background. The HTTP response returns within ~100ms and
    // syncCampaign continues running up to maxDuration. The UI surfaces a
    // "sync started" toast; results land on the next page refresh.
    after(async () => {
      try {
        // Budget the scrape phase so the sync finalizes (summary, daily
        // metrics) before the maxDuration wall instead of dying write-less.
        await syncCampaign(campaignId, Date.now() + SYNC_FETCH_BUDGET_MS);
      } catch (err) {
        console.error(
          `Background sync failed for campaign ${campaignId}:`,
          err
        );
      }
    });

    return NextResponse.json({ success: true, started: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to start sync" },
      { status: 500 }
    );
  }
}
