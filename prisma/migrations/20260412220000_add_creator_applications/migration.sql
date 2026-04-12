-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "creator_applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "instagramHandle" TEXT,
    "tiktokHandle" TEXT,
    "about" TEXT NOT NULL,
    "videoUrls" TEXT[],
    "canCommit" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creator_applications_status_idx" ON "creator_applications"("status");

-- CreateIndex
CREATE INDEX "creator_applications_createdAt_idx" ON "creator_applications"("createdAt");
