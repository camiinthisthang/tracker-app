-- AlterTable
ALTER TABLE "creators" ADD COLUMN "inviteToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "creators_inviteToken_key" ON "creators"("inviteToken");
