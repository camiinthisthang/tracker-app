export interface BonusTier {
  viewThreshold: number;
  amountUsd: number;
}

export interface BonusPost {
  id: string;
  views: number;
  title: string | null;
  link: string;
  /** The tier threshold this post cleared. */
  tierThreshold: number;
  amountUsd: number;
}

export interface CampaignBonusSummary {
  campaignId: string;
  campaignName: string;
  /** Sum of per-post tier amounts before the cap. */
  earnedUsd: number;
  /** Earned after applying the campaign's monthly cap. */
  payableUsd: number;
  capUsd: number | null;
  posts: BonusPost[];
}

/**
 * A post earns the highest tier its view count reaches (tiers are per
 * campaign). The campaign's monthly cap then bounds the per-creator total.
 */
export function computeViewBonuses(
  posts: {
    id: string;
    views: number;
    title: string | null;
    link: string;
    campaignId: string | null;
  }[],
  campaigns: {
    id: string;
    name: string;
    bonusCapUsd: number | null;
    tiers: BonusTier[];
  }[],
): CampaignBonusSummary[] {
  const summaries: CampaignBonusSummary[] = [];
  for (const campaign of campaigns) {
    if (campaign.tiers.length === 0) continue;
    const sorted = [...campaign.tiers].sort(
      (a, b) => b.viewThreshold - a.viewThreshold,
    );
    const bonusPosts: BonusPost[] = [];
    for (const post of posts) {
      if (post.campaignId !== campaign.id) continue;
      const tier = sorted.find((t) => post.views >= t.viewThreshold);
      if (!tier) continue;
      bonusPosts.push({
        id: post.id,
        views: post.views,
        title: post.title,
        link: post.link,
        tierThreshold: tier.viewThreshold,
        amountUsd: tier.amountUsd,
      });
    }
    const earnedUsd = bonusPosts.reduce((s, p) => s + p.amountUsd, 0);
    const payableUsd =
      campaign.bonusCapUsd === null
        ? earnedUsd
        : Math.min(earnedUsd, campaign.bonusCapUsd);
    summaries.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      earnedUsd,
      payableUsd,
      capUsd: campaign.bonusCapUsd,
      posts: bonusPosts.sort((a, b) => b.amountUsd - a.amountUsd),
    });
  }
  return summaries;
}
