import Link from "next/link";
import { format } from "date-fns";
import { Plus, Megaphone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function CampaignsPage() {
  const session = await getRequiredSession();

  const campaigns = await prisma.campaign.findMany({
    where: { teamId: session.user.teamId },
    include: {
      campaignCreators: true,
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Campaigns" description="Manage your UGC campaigns">
        <Link href="/campaigns/new">
          <Button className="bg-slate-800 text-white hover:bg-slate-700">
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </PageHeader>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Create your first campaign to start tracking creator content."
        >
          <Link href="/campaigns/new">
            <Button className="bg-slate-800 text-white hover:bg-slate-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.id}/overview`}
              className="group"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-slate-800 group-hover:text-blue-500">
                    {campaign.name}
                  </h3>
                  <Badge
                    variant={campaign.isActive ? "default" : "secondary"}
                    className={
                      campaign.isActive
                        ? "bg-green-50 text-green-600 hover:bg-green-50"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-100"
                    }
                  >
                    {campaign.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {format(campaign.startDate, "MMM d, yyyy")} —{" "}
                  {format(campaign.endDate, "MMM d, yyyy")}
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span>{campaign.campaignCreators.length} creators</span>
                  <span>{campaign._count.posts} posts</span>
                  {campaign.hashtags.length > 0 && (
                    <span>{campaign.hashtags.length} hashtags</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
