-- Additive only: per-creator 1-week warm-up leeway toggle (on by default).
ALTER TABLE "campaign_creators" ADD COLUMN "hasWarmupWeek" BOOLEAN NOT NULL DEFAULT true;
