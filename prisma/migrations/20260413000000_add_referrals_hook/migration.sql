-- AlterTable
ALTER TABLE "posts" ADD COLUMN "referrals" INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN "hook" TEXT;

-- CreateIndex
CREATE INDEX "posts_hook_idx" ON "posts"("hook");
