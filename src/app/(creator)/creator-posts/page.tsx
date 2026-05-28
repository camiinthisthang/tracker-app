import { Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreatorPostsTable } from "@/components/posts/creator-posts-table";

export default async function CreatorPostsPage() {
  const session = await getRequiredSession();
  const creatorId = session.user.creatorId;

  if (!creatorId) {
    return (
      <div>
        <PageHeader title="Posts" />
        <p className="text-sm text-slate-400">No creator profile linked.</p>
      </div>
    );
  }

  const posts = await prisma.post.findMany({
    where: { creatorId },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { postedAt: "desc" },
    take: 500,
  });

  const serializedPosts = posts.map((p) => ({
    id: p.id,
    title: p.title,
    link: p.link,
    platform: p.platform,
    postedAt: p.postedAt.toISOString(),
    views: p.views,
    likes: p.likes,
    shares: p.shares,
    saves: p.saves,
    comments: p.comments,
    campaign: p.campaign,
  }));

  const campaignMap = new Map<string, { id: string; name: string }>();
  for (const p of posts) campaignMap.set(p.campaign.id, p.campaign);
  const campaigns = Array.from(campaignMap.values());

  return (
    <div>
      <PageHeader title="Posts" description="Track how your posts are performing" />

      {posts.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No posts tracked yet"
          description="Your posts will appear here once your manager syncs your campaigns."
        />
      ) : (
        <CreatorPostsTable posts={serializedPosts} campaigns={campaigns} />
      )}
    </div>
  );
}
