-- Two more optional fields on a hook for the creator workflow:
--   ponchoPrompt    — copy/paste-ready prompt for Poncho when the hook needs
--                     an AI-generated image or screen.
--   inspirationLink — optional reference/example URL showing what a good
--                     video for this hook looks like.

ALTER TABLE "hooks" ADD COLUMN "ponchoPrompt" TEXT;
ALTER TABLE "hooks" ADD COLUMN "inspirationLink" TEXT;
