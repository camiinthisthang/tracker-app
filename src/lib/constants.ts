export const TIER_ORDER = ["TRAINING", "BRONZE", "SILVER", "GOLD"] as const;

export const TIER_LABELS: Record<string, string> = {
  TRAINING: "Training",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
};

export const TIER_COLORS: Record<string, string> = {
  TRAINING: "bg-slate-100 text-slate-600",
  BRONZE: "bg-amber-100 text-amber-700",
  SILVER: "bg-gray-100 text-gray-600",
  GOLD: "bg-yellow-100 text-yellow-700",
};

export const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
};

/** Platforms currently enabled for campaigns */
export const ACTIVE_PLATFORMS = [
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "YOUTUBE", label: "YouTube Shorts" },
] as const;

export const PLATFORM_ICONS: Record<string, string> = {
  TIKTOK: "music",
  INSTAGRAM: "instagram",
  YOUTUBE: "youtube",
  FACEBOOK: "facebook",
};
