-- Adjustable pacing month: each campaign can start its pacing "month" on any
-- day 1–28 (1 = calendar month), so goals can align to contract cycles.
ALTER TABLE "campaigns" ADD COLUMN "monthStartDay" INTEGER NOT NULL DEFAULT 1;
