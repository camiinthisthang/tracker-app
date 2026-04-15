-- PostHog creds on team settings
ALTER TABLE "team_settings" ADD COLUMN "posthogApiKey" TEXT;
ALTER TABLE "team_settings" ADD COLUMN "posthogProjectId" TEXT;
ALTER TABLE "team_settings" ADD COLUMN "posthogHost" TEXT;

-- CreatorAttribution table (per-day signup counts)
CREATE TABLE "creator_attributions" (
  "id"           TEXT NOT NULL,
  "creatorId"    TEXT NOT NULL,
  "date"         DATE NOT NULL,
  "signupCount"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creator_attributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_attributions_creatorId_date_key"
  ON "creator_attributions"("creatorId", "date");
CREATE INDEX "creator_attributions_creatorId_idx"
  ON "creator_attributions"("creatorId");

ALTER TABLE "creator_attributions"
  ADD CONSTRAINT "creator_attributions_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "creators"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
