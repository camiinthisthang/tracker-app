import { Music2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { campaignVisibilityWhere } from "@/lib/visibility";
import { getWeekWindow } from "@/lib/weeks";

interface Props {
  campaignWhere: ReturnType<typeof campaignVisibilityWhere>;
  weekOffset: number;
}

export async function TopSounds({ campaignWhere, weekOffset }: Props) {
  const week = getWeekWindow(weekOffset);

  const posts = await prisma.post.findMany({
    where: {
      campaign: campaignWhere,
      platform: "TIKTOK",
      postedAt: { gte: week.start, lt: week.end },
      musicTitle: { not: null },
    },
    select: {
      views: true,
      musicTitle: true,
      musicAuthor: true,
      musicOriginal: true,
    },
  });

  const bySound = new Map<
    string,
    {
      title: string;
      author: string | null;
      original: boolean;
      uses: number;
      views: number;
    }
  >();
  for (const p of posts) {
    if (!p.musicTitle) continue;
    const key = `${p.musicTitle}::${p.musicAuthor ?? ""}`.toLowerCase();
    const entry = bySound.get(key) ?? {
      title: p.musicTitle,
      author: p.musicAuthor,
      original: p.musicOriginal === true,
      uses: 0,
      views: 0,
    };
    entry.uses++;
    entry.views += p.views;
    bySound.set(key, entry);
  }

  const sounds = [...bySound.values()]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-1.5">
        <Music2 className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          Top Sounds This Week
        </h3>
      </div>
      <p className="text-xs text-slate-400">
        TikTok only — the other platforms don&apos;t expose audio data
      </p>
      {sounds.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No sound data for this week yet — it&apos;s collected on each daily
          sync going forward
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {sounds.map((s, idx) => (
            <div
              key={`${s.title}-${idx}`}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">
                  {s.title}
                  {s.original && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                      original sound
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {s.author ?? "Unknown artist"} · used in {s.uses} post
                  {s.uses === 1 ? "" : "s"}
                </p>
              </div>
              <span className="ml-4 shrink-0 text-sm font-medium text-slate-700">
                {s.views.toLocaleString()} views
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
