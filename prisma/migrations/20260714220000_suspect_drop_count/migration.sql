-- Consecutive suspicious-metric-downgrade counter per post: after 3 syncs in
-- a row report the same "suspicious" low value, accept it as real. Stops a
-- one-off inflated scrape from permanently locking in a wrong high number.
ALTER TABLE "posts" ADD COLUMN "suspectDropCount" INTEGER NOT NULL DEFAULT 0;
