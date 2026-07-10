-- AlterTable: YouTube handle for the Apify-based Shorts sync
ALTER TABLE "creators" ADD COLUMN "youtubeHandle" TEXT;

-- AlterTable: TikTok sound metadata (musicMeta from clockworks/tiktok-scraper)
ALTER TABLE "posts" ADD COLUMN "musicTitle" TEXT,
                    ADD COLUMN "musicAuthor" TEXT,
                    ADD COLUMN "musicOriginal" BOOLEAN;

-- CreateTable: extra scraped accounts per creator (shadow-ban replacements,
-- secondary accounts). Inactive rows keep historical posts but are not synced.
CREATE TABLE "creator_accounts" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_accounts_creatorId_platform_handle_key" ON "creator_accounts"("creatorId", "platform", "handle");

-- CreateIndex
CREATE INDEX "creator_accounts_creatorId_idx" ON "creator_accounts"("creatorId");

-- AddForeignKey
ALTER TABLE "creator_accounts" ADD CONSTRAINT "creator_accounts_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
