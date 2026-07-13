-- One-time backfill for the Canvas UGC accounts model shift.
--
-- Until now Poncho was tracked via each creator's profile default handles.
-- Now that default handles are opt-in per campaign, preserve what Poncho is
-- tracking by copying those handles into Poncho campaign-scoped accounts, then
-- clear the profile defaults — but ONLY the ones we successfully preserved, so
-- no handle is ever lost.
--
-- Matches the campaign by name (case-insensitive, contains "poncho"). If the
-- campaign is named differently this is a safe no-op.

-- 1. Preserve: profile default handles -> Poncho campaign accounts.
--    ON CONFLICT skips any (creator, platform, handle) that already exists.
INSERT INTO "creator_accounts" (
  "id", "creatorId", "platform", "handle", "isActive", "isShadowbanned",
  "note", "campaignId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  cc."creatorId",
  h.platform,
  h.handle,
  true,
  false,
  'Preserved from profile default handle',
  cc."campaignId",
  now(),
  now()
FROM "campaign_creators" cc
JOIN "campaigns" camp ON camp."id" = cc."campaignId"
JOIN "creators" cr ON cr."id" = cc."creatorId"
CROSS JOIN LATERAL (VALUES
  ('TIKTOK'::"Platform",    NULLIF(trim(COALESCE(cr."tiktokHandle", cr."tiktokUsername")), '')),
  ('INSTAGRAM'::"Platform", NULLIF(trim(cr."instagramHandle"), '')),
  ('YOUTUBE'::"Platform",   NULLIF(trim(cr."youtubeHandle"), ''))
) AS h(platform, handle)
WHERE lower(camp."name") LIKE '%poncho%'
  AND cc."isActive" = true
  AND h.handle IS NOT NULL
ON CONFLICT ("creatorId", "platform", "handle") DO NOTHING;

-- 2. Clear each profile default handle ONLY when a matching Poncho account now
--    exists (never drop a handle that wasn't preserved). tiktokUsername (OAuth
--    identity) is intentionally left untouched.
UPDATE "creators" cr SET
  "tiktokHandle" = CASE
    WHEN cr."tiktokHandle" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "creator_accounts" ca
      JOIN "campaigns" camp ON camp."id" = ca."campaignId"
      WHERE ca."creatorId" = cr."id" AND ca."platform" = 'TIKTOK'
        AND lower(ca."handle") = lower(cr."tiktokHandle")
        AND lower(camp."name") LIKE '%poncho%'
    ) THEN NULL ELSE cr."tiktokHandle" END,
  "instagramHandle" = CASE
    WHEN cr."instagramHandle" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "creator_accounts" ca
      JOIN "campaigns" camp ON camp."id" = ca."campaignId"
      WHERE ca."creatorId" = cr."id" AND ca."platform" = 'INSTAGRAM'
        AND lower(ca."handle") = lower(cr."instagramHandle")
        AND lower(camp."name") LIKE '%poncho%'
    ) THEN NULL ELSE cr."instagramHandle" END,
  "youtubeHandle" = CASE
    WHEN cr."youtubeHandle" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "creator_accounts" ca
      JOIN "campaigns" camp ON camp."id" = ca."campaignId"
      WHERE ca."creatorId" = cr."id" AND ca."platform" = 'YOUTUBE'
        AND lower(ca."handle") = lower(cr."youtubeHandle")
        AND lower(camp."name") LIKE '%poncho%'
    ) THEN NULL ELSE cr."youtubeHandle" END
WHERE cr."id" IN (
  SELECT cc."creatorId" FROM "campaign_creators" cc
  JOIN "campaigns" camp ON camp."id" = cc."campaignId"
  WHERE lower(camp."name") LIKE '%poncho%'
);
