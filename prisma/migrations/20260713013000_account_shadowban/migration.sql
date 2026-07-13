-- Shadow-ban per handle: a banned handle is flagged on the account row while
-- the creator keeps pacing on their replacement handles. Creator-level
-- isShadowbanned remains for the rare fully-excluded case.
ALTER TABLE "creator_accounts" ADD COLUMN "isShadowbanned" BOOLEAN NOT NULL DEFAULT false;
