-- CreateTable
CREATE TABLE "hooks" (
  "id"        TEXT NOT NULL,
  "teamId"    TEXT NOT NULL,
  "text"      TEXT NOT NULL,
  "category"  TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hooks_teamId_isActive_idx" ON "hooks"("teamId", "isActive");

ALTER TABLE "hooks"
  ADD CONSTRAINT "hooks_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Upload tagging fields
ALTER TABLE "uploads" ADD COLUMN "hookId" TEXT;
ALTER TABLE "uploads" ADD COLUMN "freestyleHook" TEXT;

ALTER TABLE "uploads"
  ADD CONSTRAINT "uploads_hookId_fkey"
  FOREIGN KEY ("hookId") REFERENCES "hooks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
