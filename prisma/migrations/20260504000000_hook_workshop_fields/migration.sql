-- Adds the workshop/publish flow fields to Hook. The original `text` column
-- is kept for back-compat with the existing analytics path that reads it.
-- New rows get `onScreenText` (mirrored into `text` by the API) plus the
-- structured `caption` + `videoDirection` direction fields. `campaignId`
-- scopes a hook to one campaign so creators only see hooks for the campaigns
-- they're on. `publishedAt` is null = workshop draft, set = visible to creators.

ALTER TABLE "hooks"
  ADD COLUMN "onScreenText"   TEXT,
  ADD COLUMN "caption"        TEXT,
  ADD COLUMN "videoDirection" TEXT,
  ADD COLUMN "campaignId"     TEXT,
  ADD COLUMN "publishedAt"    TIMESTAMP(3),
  ADD COLUMN "createdById"    TEXT;

-- Backfill: existing rows had a single `text` field; treat it as the on-screen
-- text and mark them as already published so they don't disappear from
-- creator views overnight. campaignId stays null on legacy rows — workshop
-- UI surfaces those as "unscoped" so admins can re-attach them.
UPDATE "hooks"
SET
  "onScreenText" = "text",
  "publishedAt"  = "createdAt"
WHERE "onScreenText" IS NULL;

-- Once backfilled, onScreenText is the source of truth — make it required.
ALTER TABLE "hooks" ALTER COLUMN "onScreenText" SET NOT NULL;

-- FKs.
ALTER TABLE "hooks"
  ADD CONSTRAINT "hooks_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hooks"
  ADD CONSTRAINT "hooks_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hooks_campaignId_publishedAt_idx" ON "hooks"("campaignId", "publishedAt");
