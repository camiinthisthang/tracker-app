-- Per-creator contract window on a campaign: pacing cycles from the
-- creator's own contract start (warm-up posts before it don't count), and
-- the contract tracker measures elapsed time against their window instead of
-- the whole campaign's.
ALTER TABLE "campaign_creators" ADD COLUMN "contractStart" TIMESTAMP(3);
ALTER TABLE "campaign_creators" ADD COLUMN "contractEnd" TIMESTAMP(3);
