-- Per-creator monthly post commitment. NULL means "no creator-specific goal —
-- fall back to campaign.weeklyPostTarget when computing the weekly ring target".
ALTER TABLE "campaign_creators" ADD COLUMN "monthlyPostGoal" INTEGER;
