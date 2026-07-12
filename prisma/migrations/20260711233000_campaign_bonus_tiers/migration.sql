-- Per-campaign creator view bonuses: tier table (post earns the highest tier
-- its views reach) + monthly per-creator cap on the campaign.
ALTER TABLE "campaigns" ADD COLUMN "bonusCapUsd" DECIMAL(10,2);

CREATE TABLE "campaign_bonus_tiers" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "viewThreshold" INTEGER NOT NULL,
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_bonus_tiers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campaign_bonus_tiers_campaignId_idx" ON "campaign_bonus_tiers"("campaignId");

ALTER TABLE "campaign_bonus_tiers" ADD CONSTRAINT "campaign_bonus_tiers_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
