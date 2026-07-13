import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { creatorVisibilityWhere } from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { goalPlatformFor } from "@/lib/social/goal-counting";
import { PLATFORM_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Per-creator data trace: post counts and views per platform, last synced
 * post, goal-counting mode, and suspicious posts (stored views < likes —
 * near-impossible organically, the fingerprint of the IG view-field bug).
 * Re-run after a force sync to confirm everything healed.
 */
export default async function DataAuditPage() {
  const session = await getRequiredSession();

  const creators = await prisma.creator.findMany({
    where: { ...creatorVisibilityWhere(session), isActive: true },
    include: {
      campaignCreators: {
        where: { isActive: true, campaign: { isActive: true } },
        include: { campaign: { select: { name: true } } },
      },
      accounts: { where: { isActive: true } },
    },
    orderBy: { name: "asc" },
  });
  const creatorIds = creators.map((c) => c.id);

  const [platformAgg, igPosts] = await Promise.all([
    prisma.post.groupBy({
      by: ["creatorId", "platform"],
      where: { creatorId: { in: creatorIds } },
      _count: { _all: true },
      _sum: { views: true, likes: true },
      _max: { postedAt: true },
    }),
    prisma.post.findMany({
      where: { creatorId: { in: creatorIds }, platform: "INSTAGRAM" },
      select: {
        id: true,
        creatorId: true,
        title: true,
        views: true,
        likes: true,
        link: true,
        postedAt: true,
      },
    }),
  ]);

  // views < likes can't happen organically — stored views are under-counted.
  const suspiciousByCreator = new Map<string, typeof igPosts>();
  for (const p of igPosts) {
    if (p.views >= p.likes || p.likes === 0) continue;
    const list = suspiciousByCreator.get(p.creatorId) ?? [];
    list.push(p);
    suspiciousByCreator.set(p.creatorId, list);
  }

  const aggByCreator = new Map<string, typeof platformAgg>();
  for (const a of platformAgg) {
    const list = aggByCreator.get(a.creatorId) ?? [];
    list.push(a);
    aggByCreator.set(a.creatorId, list);
  }

  const totalSuspicious = [...suspiciousByCreator.values()].reduce(
    (s, l) => s + l.length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Data audit"
        description="Per-creator trace: platform counts, last post synced, goal-counting mode, and under-counted posts. Re-run after a force sync — the suspicious list should be empty."
      />

      <div
        className={`mb-6 flex items-center gap-2 rounded-xl border p-4 ${
          totalSuspicious > 0
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        {totalSuspicious > 0 ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <p className="text-sm font-medium">
          {totalSuspicious > 0
            ? `${totalSuspicious} post${totalSuspicious === 1 ? "" : "s"} with stored views < likes (under-counted — heals on next sync)`
            : "No under-counted posts detected — stored data looks healthy."}
        </p>
      </div>

      <div className="space-y-4">
        {creators.map((c) => {
          const aggs = aggByCreator.get(c.id) ?? [];
          const suspicious = suspiciousByCreator.get(c.id) ?? [];
          const lastPost = aggs.reduce<Date | null>(
            (max, a) =>
              a._max.postedAt && (!max || a._max.postedAt > max)
                ? a._max.postedAt
                : max,
            null,
          );
          return (
            <div
              key={c.id}
              className={`rounded-xl border bg-white p-4 ${
                suspicious.length > 0 ? "border-amber-300" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/creators/${c.id}`}
                  className="text-sm font-semibold text-slate-800 hover:text-blue-600"
                >
                  {c.name}{" "}
                  <span className="font-normal text-slate-400">
                    @{c.handle}
                  </span>
                </Link>
                <p className="text-xs text-slate-400">
                  Goal platform: {PLATFORM_LABELS[goalPlatformFor(c)]} · last
                  post synced:{" "}
                  {lastPost ? format(lastPost, "MMM d, HH:mm") : "never"} ·
                  extra handles: {c.accounts.length}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {aggs.length === 0 && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                    No posts stored at all
                  </span>
                )}
                {aggs.map((a) => (
                  <span
                    key={a.platform}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {PLATFORM_LABELS[a.platform] ?? a.platform}:{" "}
                    {a._count._all} posts ·{" "}
                    {(a._sum.views ?? 0).toLocaleString()} views
                  </span>
                ))}
                {c.campaignCreators.map((cc) => (
                  <span
                    key={cc.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      cc.countAllPlatforms
                        ? "bg-blue-50 text-blue-600"
                        : "bg-slate-50 text-slate-500"
                    }`}
                    title={
                      cc.countAllPlatforms
                        ? "All posts on all platforms count toward this campaign's goal"
                        : "Only the canonical platform counts (cross-post rule)"
                    }
                  >
                    {cc.campaign.name}:{" "}
                    {cc.countAllPlatforms ? "all platforms" : "canonical only"}
                  </span>
                ))}
              </div>

              {suspicious.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-amber-100 pt-2">
                  {suspicious.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-slate-600 hover:text-blue-600"
                      >
                        {p.title?.slice(0, 60) || "(untitled)"} ·{" "}
                        {format(p.postedAt, "MMM d")}
                      </a>
                      <span className="font-medium text-amber-700">
                        stored {p.views.toLocaleString()} views vs{" "}
                        {p.likes.toLocaleString()} likes — under-counted
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
