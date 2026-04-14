-- AlterTable
ALTER TABLE "creator_messages" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- Index to make the "pinned first" fetch fast
CREATE INDEX "creator_messages_creatorId_isPinned_createdAt_idx" ON "creator_messages"("creatorId", "isPinned", "createdAt");
