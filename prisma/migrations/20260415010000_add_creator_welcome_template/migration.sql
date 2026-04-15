-- AlterTable
ALTER TABLE "team_settings" ADD COLUMN "creatorWelcomeTemplate" TEXT;

-- Seed the default copy onto existing teams so prod creators get a pinned
-- welcome immediately without anyone having to fill the field manually.
UPDATE "team_settings"
SET "creatorWelcomeTemplate" = 'Welcome to Viewtrackr — you''re officially on the roster.

First step: book your 15-minute onboarding call here: {{schedulingUrl}}
We''ll walk through your campaign, the hooks for your first batch, and answer any questions before you start filming.

Weekly target: 4 talking videos plus 10 minutes of structured b-roll, filmed in one batch session. Full brief lives on your campaign page.

Workflow: upload videos to the Uploads tab for review before posting. Our editor will cut your b-roll into short clips with hooks — you''ll see those for approval here, then you post to your own TikTok, Instagram, and Facebook accounts.

Need help: message us anytime through this app. We monitor messages daily.

Let''s get you posting.'
WHERE "creatorWelcomeTemplate" IS NULL;
