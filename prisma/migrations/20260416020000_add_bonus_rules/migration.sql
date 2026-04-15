CREATE TYPE "BonusTrigger" AS ENUM ('VIEW_THRESHOLD', 'VIRAL_COUNT');

CREATE TABLE "bonus_rules" (
  "id"        TEXT NOT NULL,
  "teamId"    TEXT NOT NULL,
  "trigger"   "BonusTrigger" NOT NULL,
  "threshold" INTEGER NOT NULL,
  "amountUsd" DECIMAL(10,2) NOT NULL,
  "label"     TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bonus_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bonus_rules_teamId_isActive_idx" ON "bonus_rules"("teamId", "isActive");

ALTER TABLE "bonus_rules"
  ADD CONSTRAINT "bonus_rules_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
