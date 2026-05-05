-- Optional `prompt` on a hook. Creators reuse this as the spoken/voice
-- prompt for the video when the hook concept calls for one. Nullable —
-- existing hooks don't get a prompt and that's fine.

ALTER TABLE "hooks" ADD COLUMN "prompt" TEXT;
