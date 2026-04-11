import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { updateCampaignSchema } from "@/lib/validations/campaign";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { campaignId } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, teamId: session.user.teamId },
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
      where: { id: campaignId, teamId: session.user.teamId },
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
      where: { id: campaignId, teamId: session.user.teamId },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
