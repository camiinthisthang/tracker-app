import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { createCreatorSchema } from "@/lib/validations/creator";

export async function GET() {
  try {
    const session = await getRequiredSession();

    const creators = await prisma.creator.findMany({
      where: { teamId: session.user.teamId },
      include: {
        campaignCreators: {
          include: {
            campaign: { select: { id: true, name: true } },
          },
        },
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute total views per creator
    const creatorIds = creators.map((c) => c.id);
    const viewsData = await prisma.post.groupBy({
      by: ["creatorId"],
      where: { creatorId: { in: creatorIds } },
      _sum: { views: true },
    });

    const viewsMap = new Map(
      viewsData.map((v) => [v.creatorId, v._sum.views ?? 0])
    );

    const enriched = creators.map((creator) => ({
      ...creator,
      totalViews: viewsMap.get(creator.id) ?? 0,
      campaignCount: creator.campaignCreators.length,
      campaigns: creator.campaignCreators.map((cc) => cc.campaign),
    }));

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch creators" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();
    const data = createCreatorSchema.parse(body);

    const creator = await prisma.creator.create({
      data: {
        teamId: session.user.teamId,
        name: data.name,
        handle: data.handle,
        email: data.email || null,
        tier: data.tier,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(creator, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create creator" },
      { status: 500 }
    );
  }
}
