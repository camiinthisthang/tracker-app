-- Product decision (Jackie, 2026-07-29): posts published more than 6 months
-- before their campaign's start date are out of tracking scope — a newly
-- added handle's ancient history (e.g. techwithkam's Feb-2023 TikToks) isn't
-- campaign performance. Sync ingest now enforces the same cutoff, so this is
-- a one-time purge of history that predates the rule. Metric snapshots
-- cascade on post delete.
DELETE FROM "posts" p
USING "campaigns" c
WHERE p."campaignId" = c.id
  AND p."postedAt" < c."startDate" - INTERVAL '6 months';
