import {
  BookOpen,
  LayoutGrid,
  Image,
  Sparkles,
  Trophy,
  Gift,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

const resources = [
  {
    icon: BookOpen,
    title: "Creator Playbook",
    description: "Best practices, content tips, and posting guidelines",
  },
  {
    icon: LayoutGrid,
    title: "Gallery Link",
    description: "View the inspiration gallery for your campaigns",
  },
  {
    icon: Image,
    title: "Creator Portfolio",
    description: "Your content portfolio and showcase",
  },
  {
    icon: Sparkles,
    title: "Sora AI Videos",
    description: "AI-generated video inspiration and tools",
  },
  {
    icon: Trophy,
    title: "Leaderboard",
    description: "See how you rank among other creators",
  },
  {
    icon: Gift,
    title: "Your Year Wrapped",
    description: "Your performance highlights and achievements",
  },
];

// TODO(cami): orphan? Every resource card below is a dead button — no
// onClick, no href. Either wire these up to real destinations (each should
// link to a doc / Notion / Canva / etc.) or cut the page.
export default function ResourcesPage() {
  return (
    <div>
      <PageHeader
        title="Resources"
        description="Playbooks, tools, and inspiration for creators"
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        These cards aren&apos;t wired up yet — your manager will drop real
        links in soon.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {resources.map((resource) => {
          const Icon = resource.icon;
          return (
            <div
              key={resource.title}
              className="flex items-start gap-4 rounded-xl border border-dashed border-slate-200 bg-white p-5 text-left opacity-70"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Icon className="h-5 w-5 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-slate-800">
                    {resource.title}
                  </h3>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {resource.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
