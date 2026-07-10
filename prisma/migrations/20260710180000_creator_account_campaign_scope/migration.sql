-- AlterTable: optionally scope a creator account to one campaign (creators on
-- multiple campaigns can use different handles per campaign). Null = global.
ALTER TABLE "creator_accounts" ADD COLUMN "campaignId" TEXT;

-- CreateIndex
CREATE INDEX "creator_accounts_campaignId_idx" ON "creator_accounts"("campaignId");

-- AddForeignKey
ALTER TABLE "creator_accounts" ADD CONSTRAINT "creator_accounts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
