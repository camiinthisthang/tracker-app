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
import { PostsGalleryClient } from "@/components/posts/posts-gallery-client";
import { Button } from "@/components/ui/button";

export default async function GalleryPage() {
  const session = await getRequiredSession();

  // Agency users see across every client team; client managers stay scoped.
  const campaignWhere = campaignVisibilityWhere(session);
  const creatorWhere = creatorVisibilityWhere(session);

  const [posts, creators] = await Promise.all([
    prisma.post.findMany({
      where: { campaign: campaignWhere },
      select: {
        id: true,
        title: true,
        link: true,
        thumbnailUrl: true,
        views: true,
        likes: true,
        comments: true,
        postedAt: true,
        creator: { select: { id: true, handle: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 200,
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
  }));

  return (
    <div>
      <PageHeader title="Gallery" description="Visual gallery of tracked content">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-0.5">
          <Link href="/posts">
            <Button variant="ghost" size="sm">
              <List className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="bg-slate-100">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      {posts.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No posts yet"
          description="Post thumbnails will appear here once content is synced."
        />
      ) : (
        <PostsGalleryClient posts={serializedPosts} creators={creators} />
      )}
    </div>
  );
}
