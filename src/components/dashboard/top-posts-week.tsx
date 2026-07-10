import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { campaignVisibilityWhere } from "@/lib/visibility";
import { PLATFORM_LABELS } from "@/lib/constants";
import { getWeekWindow } from "@/lib/weeks";
import type { Platform } from "@/generated/prisma/enums";

const PLATFORM_TABS = [
  { value: "ALL", label: "All platforms" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "YOUTUBE", label: "YT Shorts" },
] as const;

interface Props {
  campaignWhere: ReturnType<typeof campaignVisibilityWhere>;
  weekOffset: number;
  platform: string;
  top: number;
}

function dashboardUrl(week: number, platform: string, top: number) {
  const params = new URLSearchParams();
  if (week > 0) params.set("week", String(week));
  if (platform !== "ALL") params.set("platform", platform);
  if (top !== 5) params.set("top", String(top));
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export async function TopPostsWeek({
  campaignWhere,
  weekOffset,
  platform,
  top,
}: Props) {
  const week = getWeekWindow(weekOffset);

  const posts = await prisma.post.findMany({
    where: {
      campaign: campaignWhere,
      postedAt: { gte: week.start, lt: week.end },
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
          <h3 className="text-sm font-semibold text-slate-800">
            Top Posts of the Week
          </h3>
          <p className="text-xs text-slate-400">
            Ranked by views · shows the hook where we have it, so winning
            formats are easy to spot and double down on
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={dashboardUrl(weekOffset + 1, platform, top)}
            className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-32 text-center text-xs font-medium text-slate-600">
            {week.label} · {week.range}
          </span>
          {weekOffset > 0 ? (
            <Link
              href={dashboardUrl(weekOffset - 1, platform, top)}
              className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="rounded-md border border-slate-100 p-1 text-slate-200">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={dashboardUrl(weekOffset, tab.value, top)}
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
              href={dashboardUrl(weekOffset, platform, n)}
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
          this week
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
