import { NextResponse } from "next/server";
import { syncAllCampaigns } from "@/lib/social/sync";

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
    const results = await syncAllCampaigns();
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
