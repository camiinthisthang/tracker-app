import { NextResponse } from "next/server";
import { syncAllCampaigns, SYNC_FETCH_BUDGET_MS } from "@/lib/social/sync";

// syncAllCampaigns sequences through every active campaign, each of which
// scrapes Apify for N creators × 2 platforms. Default 60 s is not enough.
export const maxDuration = 300;

export async function GET(req: Request) {
  // Verify cron secret for production
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting scheduled sync for all active campaigns...");
    // Stop launching new scrapes SYNC_FETCH_BUDGET_MS in (60s before the
    // maxDuration wall) so every completed scrape's data and the sync summary
    // are always persisted; unfetched handles defer to the next nightly run.
    const results = await syncAllCampaigns(
      undefined,
      Date.now() + SYNC_FETCH_BUDGET_MS
    );
    console.log(`Sync complete. ${results.length} campaigns processed.`);

    return NextResponse.json({
      success: true,
      campaignsProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
