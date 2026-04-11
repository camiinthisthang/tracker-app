import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { createCampaignSchema } from "@/lib/validations/campaign";

export async function GET() {
  try {
    const session = await getRequiredSession();

    const campaigns = await prisma.campaign.findMany({
      where: { teamId: session.user.teamId },
      include: {
        campaignCreators: {
          include: { creator: true },
        },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();
    const data = createCampaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        teamId: session.user.teamId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive,
        hashtags: data.hashtags,
        weeklyPostTarget: data.weeklyPostTarget,
        ugcEngineer: data.ugcEngineer,
        previewLinks: data.previewLinks,
        galleryUrls: data.galleryUrls,
        campaignCreators: {
          create: await Promise.all(
            data.creators.map(async (c) => {
              // Find or create the creator
              let creator = await prisma.creator.findFirst({
                where: {
                  teamId: session.user.teamId,
                  handle: c.handle,
                },
              });

              if (!creator) {
                creator = await prisma.creator.create({
                  data: {
                    teamId: session.user.teamId,
                    name: c.creatorName || c.handle,
                    handle: c.handle,
                  },
                });
              }

              return {
                creatorId: creator.id,
                platform: c.platform,
                videosPerDay: c.videosPerDay,
                isActive: c.isActive,
              };
            })
          ),
        },
      },
      include: {
        campaignCreators: {
          include: { creator: true },
        },
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Create campaign error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
