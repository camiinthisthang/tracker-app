import Link from "next/link";
import { Lightbulb } from "lucide-react";

interface Props {
  hasHandle: boolean;
  hasHooks: boolean;
}

// Lightweight playbook shown to creators so the loop (pick a hook → copy →
// record → upload) is obvious without anyone walking them through it. Always
// visible — even strong creators don't mind a quick reference, and weaker
// ones genuinely need it.
export function CreatorStartGuide({ hasHandle, hasHooks }: Props) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          How this week works
        </h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Ring light out, phone up. Each video should take a few minutes.
      </p>
      <ol className="mt-3 space-y-2 text-xs text-slate-700">
        {!hasHandle && (
          <Step n={0} title="Connect your TikTok &amp; Instagram handles">
            We pull your stats from these. Add them on your{" "}
            <Link href="/profile" className="text-blue-600 hover:underline">
              Profile
            </Link>{" "}
            page so this dashboard lights up.
          </Step>
        )}
        <Step n={1} title="Pick a hook below">
          {hasHooks
            ? "Your manager has dropped hooks for this week. Each one comes with the on-screen text, what to say, and (if it needs one) a Poncho prompt."
            : "When your manager publishes hooks, they’ll appear below this card with everything you need to film."}
        </Step>
        <Step n={2} title="Copy the on-screen text + caption">
          Tap the Copy buttons on the hook card. Paste them into TikTok / Instagram
          as you film and post.
        </Step>
        <Step n={3} title="Need an image or screen? Paste the Poncho prompt">
          Some hooks include a copy-ready Poncho prompt. Paste it into Poncho to
          generate the visual. Stick to the prompt as-written — it’s tuned for a
          realistic, anonymous-feeling look that performs well.
        </Step>
        <Step n={4} title="Record and post">
          Vertical video, good light, your voice if the hook has one. Then post
          from your brand TikTok / Instagram.
        </Step>
        <Step n={5} title="Drop the link in Uploads">
          Head to{" "}
          <Link
            href="/creator-uploads"
            className="text-blue-600 hover:underline"
          >
            Uploads
          </Link>{" "}
          and paste the post link so we can track it. Stats appear within ~24h.
        </Step>
      </ol>
      <p className="mt-3 text-[11px] text-slate-400">
        Stuck or unsure? Message your manager — better to ask than to make a
        video you’re not sure about.
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white">
        {n === 0 ? "!" : n}
      </span>
      <span>
        <span className="font-medium text-slate-800">{title}.</span>{" "}
        <span className="text-slate-600">{children}</span>
      </span>
    </li>
  );
}
