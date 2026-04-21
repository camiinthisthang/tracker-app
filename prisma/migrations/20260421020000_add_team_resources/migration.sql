-- TeamResource: admin-curated list of links (Notion, Drive, Loom, etc.) shown
-- on the creator-facing /creator-resources page. No file storage — just URLs.
-- Creators can open any resource their home team has curated.
CREATE TABLE "team_resources" (
  "id"          TEXT          NOT NULL,
  "teamId"      TEXT          NOT NULL,
  "title"       TEXT          NOT NULL,
  "url"         TEXT          NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "sortOrder"   INTEGER       NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "team_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_resources_teamId_idx" ON "team_resources"("teamId");

ALTER TABLE "team_resources"
  ADD CONSTRAINT "team_resources_teamId_fkey"
  FOREIGN KEY ("teamId")
  REFERENCES "teams"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
