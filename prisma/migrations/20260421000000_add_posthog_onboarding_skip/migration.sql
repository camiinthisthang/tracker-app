-- Add a timestamp for when a client manager skipped the PostHog onboarding
-- step. Nullable. Used to (a) not re-prompt on subsequent logins, (b) give us
-- a way to surface a "you haven't set up PostHog yet" reminder later.
ALTER TABLE "team_settings"
  ADD COLUMN "posthogOnboardingSkippedAt" TIMESTAMP(3);
