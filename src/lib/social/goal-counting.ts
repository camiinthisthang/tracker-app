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
