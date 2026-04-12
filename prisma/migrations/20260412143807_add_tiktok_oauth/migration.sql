-- AlterTable
ALTER TABLE "creators" ADD COLUMN     "tiktokAccessToken" TEXT,
ADD COLUMN     "tiktokConnectedAt" TIMESTAMP(3),
ADD COLUMN     "tiktokRefreshToken" TEXT,
ADD COLUMN     "tiktokTokenExpires" TIMESTAMP(3),
ADD COLUMN     "tiktokUserId" TEXT,
ADD COLUMN     "tiktokUsername" TEXT;
