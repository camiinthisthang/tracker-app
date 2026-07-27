import type { Platform } from "@/generated/prisma/enums";

/**
 * Returns the platform that counts toward the creator's weekly goal.
 *
 * Assumption: creators cross-post the same video to both Instagram and TikTok,
 * so counting both platforms double-counts each video. We pick Instagram as
 * canonical when the creator has an IG handle; fall back to TikTok when they
 * don't (otherwise a TikTok-only creator would never make ring progress).
 *
 * The cross-post-audit views surface gaps in this assumption so we can catch
 * creators who post to IG but not TikTok (or vice versa).
 */
export function goalPlatformFor(creator: {
  instagramHandle: string | null;
}): Platform {
  return creator.instagramHandle ? "INSTAGRAM" : "TIKTOK";
}

/** Predicate version, ergonomic when filtering an array of posts. */
export function countsTowardGoal(
  post: { platform: Platform },
  creator: { instagramHandle: string | null }
): boolean {
  return post.platform === goalPlatformFor(creator);
}

/**
 * Per-creator-per-campaign variant: when the CampaignCreator has
 * countAllPlatforms (unique content on every handle, no cross-posting),
 * every post counts; otherwise the canonical-platform rule applies.
 */
export function countsTowardGoalCc(
  post: { platform: Platform },
  creator: { instagramHandle: string | null },
  cc: { countAllPlatforms: boolean } | undefined
): boolean {
  return (cc?.countAllPlatforms ?? false) || countsTowardGoal(post, creator);
}

/** Post count per platform, e.g. { TIKTOK: 5, INSTAGRAM: 7 }. Accepts loose
 * string platforms so pages with untyped selects can use it directly. */
export function platformCounts(
  posts: { platform: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of posts) counts[p.platform] = (counts[p.platform] ?? 0) + 1;
  return counts;
}

/**
 * Contracted deliverables are UNIQUE videos, each cross-posted to every
 * platform (per Jacqueline, 2026-07-27: "40 unique videos, but they must be
 * cross-posted"). Platforms share no video id, so the unique count is
 * approximated as the MAX per-platform count in the window — exact whenever
 * every unique video reaches the creator's most-posted platform, and never
 * the 2–3× inflation that summing platform copies gives. Reduces to plain
 * length when the posts are single-platform (countAllPlatforms off, posts
 * pre-filtered to the goal platform).
 */
export function uniqueVideoCount(posts: { platform: string }[]): number {
  const counts = Object.values(platformCounts(posts));
  return counts.length ? Math.max(...counts) : 0;
}
