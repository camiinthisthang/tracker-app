import Link from "next/link";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { campaignVisibilityWhere } from "@/lib/visibility";
import { PLATFORM_LABELS } from "@/lib/constants";
import { dashboardUrl, type DashboardParams } from "@/lib/dashboard-url";
import type { Platform } from "@/generated/prisma/enums";

const PLATFORM_TABS = [
  { value: "ALL", label: "All platforms" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "YOUTUBE", label: "YT Shorts" },
] as const;

interface Props {
  campaignWhere: ReturnType<typeof campaignVisibilityWhere>;
  rangeStart: Date;
  rangeEnd: Date;
  rangeLabel: string;
  platform: string;
  top: number;
  params: DashboardParams;
}

export async function TopPosts({
  campaignWhere,
  rangeStart,
  rangeEnd,
  rangeLabel,
  platform,
  top,
  params,
}: Props) {
  const posts = await prisma.post.findMany({
    where: {
      campaign: campaignWhere,
      postedAt: { gte: rangeStart, lt: rangeEnd },
      ...(platform !== "ALL" ? { platform: platform as Platform } : {}),
    },
    include: {
      creator: { select: { id: true, handle: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { views: "desc" },
    take: top,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Top Posts</h3>
          <p className="text-xs text-slate-400">
            Ranked by views · shows the hook where we have it, so winning
            formats are easy to spot and double down on
          </p>
        </div>
        <span className="text-xs font-medium text-slate-600">
          {rangeLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={dashboardUrl({ ...params, platform: tab.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                platform === tab.value
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[5, 10].map((n) => (
            <Link
              key={n}
              href={dashboardUrl({ ...params, top: n })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                top === n
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Top {n}
            </Link>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No posts {platform !== "ALL" ? `on ${PLATFORM_LABELS[platform]} ` : ""}
          in this period
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {posts.map((post, idx) => (
            <div
              key={post.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {post.hook ? (
                      <>
                        <Sparkles className="mr-1 inline h-3 w-3 text-blue-500" />
                        {post.hook}
                      </>
                    ) : (
                      post.title || "Untitled post"
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    <Link
                      href={`/creators/${post.creator.id}`}
                      className="hover:text-blue-500"
                    >
                      @{post.creator.handle}
                    </Link>{" "}
                    · {post.campaign.name} · {PLATFORM_LABELS[post.platform]}
                    {post.hook && post.title ? ` · ${post.title}` : ""}
                  </p>
                </div>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {post.views.toLocaleString()} views
                </span>
                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Link
          href="/posts"
          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
        >
          View all posts <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
