import Link from "next/link";
import { List, LayoutGrid } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PostsTableClient } from "@/components/posts/posts-table-client";
import { Button } from "@/components/ui/button";

export default async function PostsPage() {
  const session = await getRequiredSession();
  const teamId = session.user.teamId;

  const [posts, campaigns, creators] = await Promise.all([
    prisma.post.findMany({
      where: { campaign: { teamId } },
      include: {
        creator: { select: { id: true, name: true, handle: true } },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 500,
    }),
    prisma.campaign.findMany({
      where: { teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.creator.findMany({
      where: { teamId },
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

      {posts.length === 0 ? (
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
        />
      )}
    </div>
  );
}
