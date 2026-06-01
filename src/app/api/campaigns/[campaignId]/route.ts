import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import { updateCampaignSchema } from "@/lib/validations/campaign";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { campaignId } = await params;

    // Agency users can read any client's campaign; client managers only theirs.
    const campaign = await prisma.campaign.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: campaignId }
        : { id: campaignId, teamId: session.user.teamId },
      include: {
        campaignCreators: {
          include: { creator: true },
        },
        _count: { select: { posts: true, tasks: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { campaignId } = await params;
    const body = await req.json();
    const data = updateCampaignSchema.parse(body);

    const campaign = await prisma.campaign.update({
      where: hasAgencyWideAccess(session)
        ? { id: campaignId }
        : { id: campaignId, teamId: session.user.teamId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.startDate !== undefined && {
          startDate: new Date(data.startDate),
        }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.hashtags !== undefined && { hashtags: data.hashtags }),
        ...(data.weeklyPostTarget !== undefined && {
          weeklyPostTarget: data.weeklyPostTarget,
        }),
        ...(data.ugcEngineer !== undefined && {
          ugcEngineer: data.ugcEngineer,
        }),
        ...(data.previewLinks !== undefined && {
          previewLinks: data.previewLinks,
        }),
        ...(data.galleryUrls !== undefined && {
          galleryUrls: data.galleryUrls,
        }),
      },
    });

    // Upsert any per-creator changes from the form (videosPerDay,
    // monthlyPostGoal, platform, isActive). Removals still go through the
    // dedicated DELETE /api/campaigns/[id]/creators endpoint so an empty
    // creators array here is treated as "no changes", not "remove all".
    if (data.creators !== undefined) {
      for (const c of data.creators) {
        if (!c.creatorId) continue;
        await prisma.campaignCreator.upsert({
          where: {
            campaignId_creatorId: { campaignId, creatorId: c.creatorId },
          },
          create: {
            campaignId,
            creatorId: c.creatorId,
            platform: c.platform,
            videosPerDay: c.videosPerDay,
            monthlyPostGoal: c.monthlyPostGoal ?? null,
            isActive: c.isActive,
          },
          update: {
            platform: c.platform,
            videosPerDay: c.videosPerDay,
            monthlyPostGoal: c.monthlyPostGoal ?? null,
            isActive: c.isActive,
          },
        });
      }
    }

    return NextResponse.json(campaign);
  } catch {
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { campaignId } = await params;

    await prisma.campaign.delete({
      where: hasAgencyWideAccess(session)
        ? { id: campaignId }
        : { id: campaignId, teamId: session.user.teamId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
