-- Add ONBOARDING to TaskType
ALTER TYPE "TaskType" ADD VALUE 'ONBOARDING';

-- Drop NOT NULL + onDelete constraint changes on Task.campaignId
-- (campaign FK becomes optional; cascade still applies when set).
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_campaignId_fkey";
ALTER TABLE "tasks" ALTER COLUMN "campaignId" DROP NOT NULL;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- UploadCategory + Upload.category default CONTENT
CREATE TYPE "UploadCategory" AS ENUM ('CONTENT', 'ONBOARDING_DOCS');
ALTER TABLE "uploads" ADD COLUMN "category" "UploadCategory" NOT NULL DEFAULT 'CONTENT';

-- Make Upload.campaignId nullable so onboarding docs aren't tied to a campaign.
ALTER TABLE "uploads" DROP CONSTRAINT "uploads_campaignId_fkey";
ALTER TABLE "uploads" ALTER COLUMN "campaignId" DROP NOT NULL;
ALTER TABLE "uploads"
  ADD CONSTRAINT "uploads_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
