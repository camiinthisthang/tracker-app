import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isAgencyTeamSlug, hasAgencyWideAccess } from "@/lib/auth";
import { campaignVisibilityWhere } from "@/lib/visibility";
import { createCampaignSchema } from "@/lib/validations/campaign";

export async function GET() {
  try {
    const session = await getRequiredSession();

    const campaigns = await prisma.campaign.findMany({
      where: campaignVisibilityWhere(session),
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

    // Resolve the team this campaign belongs to. Agency super admins / agency
    // managers must pick a client team explicitly; client managers fall back
    // to their own team.
    let teamId = session.user.teamId;
    if (hasAgencyWideAccess(session)) {
      if (!data.teamId) {
        return NextResponse.json(
          { error: "Pick a client to create the campaign under" },
          { status: 400 }
        );
      }
      const target = await prisma.team.findUnique({
        where: { id: data.teamId },
        select: { id: true, slug: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: "Client team not found" },
          { status: 404 }
        );
      }
      if (isAgencyTeamSlug(target.slug)) {
        return NextResponse.json(
          { error: "Campaigns must belong to a client, not the agency team" },
          { status: 400 }
        );
      }
      teamId = target.id;
    }

    const campaign = await prisma.campaign.create({
      data: {
        teamId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive,
        hashtags: data.hashtags,
        weeklyPostTarget: data.weeklyPostTarget,
        monthlyPostGoal: data.monthlyPostGoal ?? null,
        offPacePct: data.offPacePct,
        quietDays: data.quietDays,
        bonusCapUsd: data.bonusCapUsd ?? null,
        bonusTiers: {
          create: data.bonusTiers.map((t) => ({
            viewThreshold: t.viewThreshold,
            amountUsd: t.amountUsd,
          })),
        },
        monthStartDay: data.monthStartDay,
        ugcEngineer: data.ugcEngineer,
        previewLinks: data.previewLinks,
        galleryUrls: data.galleryUrls,
        campaignCreators: {
          // Creators must already exist on this team — the admin picks from
          // the roster via the campaign form. New creators are created
          // through the dedicated "New creator" modal on /creators.
          create: data.creators.map((c) => ({
            creatorId: c.creatorId,
            platform: c.platform,
            videosPerDay: c.videosPerDay,
            monthlyPostGoal: c.monthlyPostGoal ?? null,
            isActive: c.isActive,
          })),
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
