import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import { resolveSyncHandles } from "@/lib/social/sync";
import { debugScrapeInstagram } from "@/lib/social/apify";

/**
 * Read-only Instagram scrape diagnostic (writes NOTHING to the DB). Runs both
 * IG actors (feed + Reels tab) for each of the creator's Instagram handles
 * and returns the raw view-related fields per item — open in the browser to
 * see exactly what Apify reports for a post whose views look wrong (the
 * Aspen "2.8K shown vs 30.1K real" investigation, 2026-07-15).
 *
 * Costs a few cents of Apify credits per call (2 actors × ~10 results).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  // ?limit=30 → scrape depth per actor (default 10, capped at 60 to match
  // the real sync and keep credit spend bounded).
  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit =
    Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, 60)
      : 10;
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId } = await params;
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      accounts: true,
      campaignCreators: {
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { useDefaultHandles: true, campaign: { select: { id: true } } },
      },
    },
  });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const membership = creator.campaignCreators[0];
  const igHandles = resolveSyncHandles(
    {
      handle: creator.handle,
      tiktokHandle: creator.tiktokHandle,
      tiktokUsername: creator.tiktokUsername,
      instagramHandle: creator.instagramHandle,
      youtubeHandle: creator.youtubeHandle,
      accounts: creator.accounts,
    },
    membership?.campaign.id ?? null,
    membership ? membership.useDefaultHandles : true
  ).filter((h) => h.platform === "INSTAGRAM");

  if (igHandles.length === 0) {
    return NextResponse.json({
      creator: creator.handle,
      results: [],
      note: "No syncable Instagram handles on this creator.",
    });
  }

  const results = await Promise.all(
    igHandles.map((h) => debugScrapeInstagram(h.handle, limit))
  );
  return NextResponse.json({
    creator: creator.handle,
    note: "Read-only — nothing was written. computedViews = what the sync would store (highest of rawViewFields).",
    results,
  });
}
