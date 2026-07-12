-- Pacing & flags: campaign-wide monthly post goal + per-campaign thresholds
-- for the Off-pace / Quiet flags, and a creator shadowban flag that excludes
-- the creator from pacing.
ALTER TABLE "campaigns" ADD COLUMN "monthlyPostGoal" INTEGER;
ALTER TABLE "campaigns" ADD COLUMN "offPacePct" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "campaigns" ADD COLUMN "quietDays" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "creators" ADD COLUMN "isShadowbanned" BOOLEAN NOT NULL DEFAULT false;
