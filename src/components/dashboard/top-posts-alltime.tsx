import Link from "next/link";
import { ExternalLink, Sparkles, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { campaignVisibilityWhere } from "@/lib/visibility";
import { PLATFORM_LABELS } from "@/lib/constants";

interface Props {
  campaignWhere: ReturnType<typeof campaignVisibilityWhere>;
}

export async function TopPostsAllTime({ campaignWhere }: Props) {
  const posts = await prisma.post.findMany({
    where: { campaign: campaignWhere },
    include: {
      creator: { select: { id: true, handle: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { views: "desc" },
    take: 10,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-1.5">
        <Trophy className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          All-Time Top Posts
        </h3>
      </div>
      <p className="text-xs text-slate-400">
        Highest-viewed videos across all campaigns
      </p>
      {posts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No posts yet</p>
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
    </div>
  );
}
