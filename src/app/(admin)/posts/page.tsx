import Link from "next/link";
import { List, LayoutGrid } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import {
  campaignVisibilityWhere,
  creatorVisibilityWhere,
} from "@/lib/visibility";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PostsTableClient } from "@/components/posts/posts-table-client";
import { Button } from "@/components/ui/button";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    creator?: string;
    campaign?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await getRequiredSession();
  const sp = await searchParams;

  // Agency users (super admin / agency manager) see posts across every client
  // team; client managers stay scoped to their own team. Helpers return {} for
  // agency-wide access or { teamId } for client-scoped access. Filters and
  // dropdown options need to match — surfacing a creator/campaign in the
  // filter that's not in the data confuses the UI.
  const campaignWhere = campaignVisibilityWhere(session);
  const creatorWhere = creatorVisibilityWhere(session);

  // Filters apply in the DB query, not client-side: the page loads only the
  // newest 500 rows, so filtering in the browser made any creator whose posts
  // aged out of that window (e.g. cut creators, who stop producing new posts)
  // look like they had no posts at all.
  const from = sp.from ? new Date(`${sp.from}T00:00:00`) : null;
  const to = sp.to ? new Date(`${sp.to}T23:59:59.999`) : null;
  const postWhere = {
    campaign: campaignWhere,
    ...(sp.campaign ? { campaignId: sp.campaign } : {}),
    ...(sp.creator ? { creatorId: sp.creator } : {}),
    ...(from || to
      ? {
          postedAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [posts, campaigns, creators] = await Promise.all([
    prisma.post.findMany({
      where: postWhere,
      include: {
        creator: { select: { id: true, name: true, handle: true } },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 500,
    }),
    prisma.campaign.findMany({
      where: campaignWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.creator.findMany({
      where: creatorWhere,
      select: { id: true, handle: true },
      orderBy: { handle: "asc" },
    }),
  ]);

  const serializedPosts = posts.map((p) => ({
    ...p,
    postedAt: p.postedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const hasFilters = Boolean(sp.creator || sp.campaign || sp.from || sp.to);

  return (
    <div>
      <PageHeader title="Posts" description="View all tracked posts across campaigns">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-0.5">
          <Button variant="ghost" size="sm" className="bg-slate-100">
            <List className="h-4 w-4" />
          </Button>
          <Link href="/posts/gallery">
            <Button variant="ghost" size="sm">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </PageHeader>

      {posts.length === 0 && !hasFilters ? (
        <EmptyState
          icon={List}
          title="No posts tracked yet"
          description="Posts will appear here once you sync your campaigns with social platform data."
        />
      ) : (
        <PostsTableClient
          posts={serializedPosts}
          campaigns={campaigns}
          creators={creators}
          filters={{
            campaign: sp.campaign ?? "all",
            creator: sp.creator ?? "all",
            from: sp.from ?? "",
            to: sp.to ?? "",
          }}
        />
      )}
    </div>
  );
}
