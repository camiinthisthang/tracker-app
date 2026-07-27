-- Product decision (Jackie, 2026-07-27): creators deliver across TikTok,
-- Instagram, and YouTube — posts on every platform count toward goals.
-- Flip the default for new memberships and backfill existing ones (Jackie
-- had already toggled the active roster on by hand; this makes it universal).
ALTER TABLE "campaign_creators" ALTER COLUMN "countAllPlatforms" SET DEFAULT true;
UPDATE "campaign_creators" SET "countAllPlatforms" = true;
