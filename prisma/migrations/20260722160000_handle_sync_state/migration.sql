-- Apify burn control: per-(platform, handle) scrape bookkeeping so sync can
-- skip freshly-scraped handles and run cheap shallow scrapes between weekly
-- deep passes. Additive only.
CREATE TABLE "handle_sync_states" (
  "id"            TEXT NOT NULL,
  "platform"      "Platform" NOT NULL,
  "handle"        TEXT NOT NULL,
  "lastSuccessAt" TIMESTAMP(3),
  "lastDeepAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "handle_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "handle_sync_states_platform_handle_key"
  ON "handle_sync_states"("platform", "handle");
