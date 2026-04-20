import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { creatorVisibilityWhere } from "@/lib/visibility";
import { createCreatorSchema } from "@/lib/validations/creator";
import { sendCreatorInvite } from "@/lib/email/creator-invite";

export async function GET() {
  try {
    const session = await getRequiredSession();

    const creators = await prisma.creator.findMany({
      where: creatorVisibilityWhere(session),
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

    // Only super admins can create a creator for a different team.
    // Everyone else is locked to their own team.
    const teamId =
      session.user.isSuperAdmin && data.teamId
        ? data.teamId
        : session.user.teamId;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 400 });
    }

    const inviteToken = crypto.randomBytes(16).toString("hex");
    const email = data.email?.trim() || null;

    // Handle is an internal display slug on the creator card. Auto-derive from
    // name if the caller didn't pass one — e.g. "Jane Doe" → "jane.doe".
    const handle = data.handle?.trim().replace(/^@+/, "") ||
      data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");

    const creator = await prisma.creator.create({
      data: {
        teamId: team.id,
        name: data.name,
        handle,
        email,
        tier: data.tier,
        isActive: data.isActive,
        inviteToken,
      },
    });

    // Fire the invite email if we have an address and the caller didn't opt out.
    // Don't block the response on send failure — the inviteUrl is returned
    // regardless so the admin can copy-paste if delivery fails.
    let inviteEmailSent = false;
    let inviteEmailError: string | null = null;
    if (email && data.sendInvite) {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        req.headers.get("origin") ||
        "https://viewtrackr.com";
      const inviteUrl = `${origin}/invite/${inviteToken}`;
      const result = await sendCreatorInvite({
        to: email,
        creatorName: creator.name,
        teamName: team.name,
        inviteUrl,
      });
      inviteEmailSent = result.ok;
      if (!result.ok) inviteEmailError = result.reason;
    }

    return NextResponse.json(
      {
        ...creator,
        inviteUrl: `/invite/${inviteToken}`,
        inviteEmailSent,
        inviteEmailError,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/creators failed", err);
    return NextResponse.json(
      { error: "Failed to create creator" },
      { status: 500 }
    );
  }
}
