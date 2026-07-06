import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getRequiredSession,
  isAgencyTeamSlug,
  hasAgencyWideAccess,
} from "@/lib/auth";
import { creatorVisibilityWhere } from "@/lib/visibility";
import { createCreatorSchema } from "@/lib/validations/creator";
import { sendCreatorInvite } from "@/lib/email/creator-invite";
import { findEmailConflict } from "@/lib/email-conflict";
import { createOnboardingTasks } from "@/lib/tasks/onboarding";
import { BRAND_URL } from "@/lib/brand";

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

    // Agency-wide users (super admins + agency managers) create creators for a
    // chosen client team. Client managers are locked to their own team — they
    // never send a teamId. This is what lets an agency manager on the DropDeck
    // team add a creator at all: without it they'd fall through to their own
    // (agency) team and hit the agency-team guard below.
    const teamId =
      hasAgencyWideAccess(session) && data.teamId
        ? data.teamId
        : session.user.teamId;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, slug: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 400 });
    }
    // Belt-and-suspenders for the UI fix on /creators. The agency team is
    // admins-only by intent — creators here pollute /team and break visibility
    // rules. Refuse it explicitly with an actionable message.
    if (isAgencyTeamSlug(team.slug)) {
      return NextResponse.json(
        {
          error:
            "Creators can't belong to the agency team. Pick a client team (e.g. Merit) instead.",
        },
        { status: 400 }
      );
    }

    const inviteToken = crypto.randomBytes(16).toString("hex");
    const email = data.email?.trim() || null;

    if (email) {
      const conflict = await findEmailConflict(email);
      if (conflict) {
        return NextResponse.json(
          {
            error: conflict.message,
            suggestion: conflict.suggestion,
            conflict: { table: conflict.table, existingId: conflict.existingId },
          },
          { status: 409 }
        );
      }
    }

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

    // Queue the standard onboarding tasks (tax form + FTC/account warming) so
    // the creator sees them on their first login. Idempotent in the helper —
    // safe to call without checking first. Matches the application-approve
    // path in src/app/api/applications/[applicationId]/route.ts.
    await createOnboardingTasks(creator.id);

    // Fire the invite email if we have an address and the caller didn't opt out.
    // Don't block the response on send failure — the inviteUrl is returned
    // regardless so the admin can copy-paste if delivery fails.
    let inviteEmailSent = false;
    let inviteEmailError: string | null = null;
    if (email && data.sendInvite) {
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ||
        req.headers.get("origin") ||
        BRAND_URL;
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
