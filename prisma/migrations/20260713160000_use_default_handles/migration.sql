-- Canvas UGC: creators spin up fresh handles per campaign, so a creator's
-- profile default handles are no longer auto-synced for a campaign. Opt in
-- per creator-per-campaign when a default handle really is the tracked one.
ALTER TABLE "campaign_creators" ADD COLUMN "useDefaultHandles" BOOLEAN NOT NULL DEFAULT false;
