-- Store the outcome of the most recent sync per campaign so API failures
-- (e.g. Apify credit exhaustion) surface in the UI instead of silently
-- showing stale or zero metrics.
ALTER TABLE "campaigns" ADD COLUMN "lastSyncSummary" JSONB;
