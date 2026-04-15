ALTER TABLE "creators" ADD COLUMN "notificationPrefs" JSONB;

CREATE TYPE "ViralNotificationChannel" AS ENUM ('EMAIL', 'SMS');

CREATE TABLE "viral_notifications" (
  "id"        TEXT NOT NULL,
  "postId"    TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "channel"   "ViralNotificationChannel" NOT NULL,
  "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"    TEXT NOT NULL DEFAULT 'SENT',
  "errorMsg"  TEXT,

  CONSTRAINT "viral_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "viral_notifications_postId_channel_key"
  ON "viral_notifications"("postId", "channel");
CREATE INDEX "viral_notifications_creatorId_idx"
  ON "viral_notifications"("creatorId");

ALTER TABLE "viral_notifications"
  ADD CONSTRAINT "viral_notifications_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "creators"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
