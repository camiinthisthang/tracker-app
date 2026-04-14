-- CreateEnum
CREATE TYPE "CreatorMessageType" AS ENUM ('HOOK_SUGGESTION', 'FEEDBACK', 'ANNOUNCEMENT', 'CAMPAIGN_UPDATE');

-- CreateTable
CREATE TABLE "creator_messages" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" "CreatorMessageType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creator_messages_creatorId_createdAt_idx" ON "creator_messages"("creatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "creator_messages" ADD CONSTRAINT "creator_messages_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_messages" ADD CONSTRAINT "creator_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
