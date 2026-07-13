-- Per-creator goal counting: creators who post unique content on every
-- platform/handle can count all posts toward pacing, while cross-posters
-- keep the canonical-platform rule that avoids double-counting.
ALTER TABLE "campaign_creators" ADD COLUMN "countAllPlatforms" BOOLEAN NOT NULL DEFAULT false;
