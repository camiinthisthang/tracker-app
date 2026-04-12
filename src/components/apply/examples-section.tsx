import { Clock, Sparkles, Zap } from "lucide-react";
import { TikTokEmbed } from "./tiktok-embed";

// TODO: Replace with your actual example TikTok URLs
const examples = [
  {
    url: "https://www.tiktok.com/@zachking/video/7261720736873565486",
    caption: "Short hook — ~10 seconds, simple setup",
  },
  {
    url: "https://www.tiktok.com/@zachking/video/7261720736873565486",
    caption: "Mid-length demo — ~30 seconds, trending audio",
  },
  {
    url: "https://www.tiktok.com/@zachking/video/7261720736873565486",
    caption: "Longer POV — ~90 seconds, talking style",
  },
];

const traits = [
  {
    icon: Clock,
    label: "Length: 7–120 seconds",
    description: "Most videos are under 30s. Not every video is a full 2-min talking head.",
  },
  {
    icon: Sparkles,
    label: "Mix of formats",
    description:
      "Talking heads, POVs, trending audio, product demos, reactions, skits, voiceovers.",
  },
  {
    icon: Zap,
    label: "Phone-shot is the standard",
    description:
      "You don't need lighting kits or editing rigs. CapCut or native edits on your phone are ideal.",
  },
];

export function ExamplesSection() {
  return (
    <section className="border-t border-slate-100 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            Real examples
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            These aren&apos;t all polished 2-min epics
          </h2>
          <p className="mt-3 text-base text-slate-600">
            New to UGC? Don&apos;t stress. Most videos in your 60/month are
            short, casual, and phone-shot. Here&apos;s what a typical mix looks
            like.
          </p>
        </div>

        {/* Video examples */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((ex, i) => (
            <TikTokEmbed key={i} url={ex.url} caption={ex.caption} />
          ))}
        </div>

        {/* Traits */}
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {traits.map((trait) => {
            const Icon = trait.icon;
            return (
              <div
                key={trait.label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <Icon className="h-5 w-5 text-blue-600" />
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {trait.label}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {trait.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
