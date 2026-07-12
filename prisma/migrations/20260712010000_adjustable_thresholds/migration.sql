-- Adjustable thresholds: per-campaign viral definition, team-level Weekly
-- Shoutouts qualifying rules.
ALTER TABLE "campaigns" ADD COLUMN "viralThreshold" INTEGER NOT NULL DEFAULT 50000;
ALTER TABLE "team_settings" ADD COLUMN "shoutoutMinViews" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "team_settings" ADD COLUMN "shoutoutMinPriorPosts" INTEGER NOT NULL DEFAULT 3;
