-- CreateEnum
CREATE TYPE "BrandInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'WON', 'ARCHIVED');

-- CreateTable
CREATE TABLE "brand_inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "link" TEXT,
    "startWindow" TEXT,
    "about" TEXT NOT NULL,
    "status" "BrandInquiryStatus" NOT NULL DEFAULT 'NEW',
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_inquiries_status_idx" ON "brand_inquiries"("status");

-- CreateIndex
CREATE INDEX "brand_inquiries_createdAt_idx" ON "brand_inquiries"("createdAt");
