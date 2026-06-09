-- Per-platform contracted video commitments for the campaign contract tracker.
ALTER TABLE "campaign_creators" ADD COLUMN "contractedTiktok" INTEGER;
ALTER TABLE "campaign_creators" ADD COLUMN "contractedInstagram" INTEGER;
