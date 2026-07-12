import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

// TODO(P1): agency admins editing client settings needs a team selector
// — this route is intentionally scoped to the caller's own team for now.
export async function GET() {
  try {
    const session = await getRequiredSession();

    const team = await prisma.team.findUnique({
      where: { id: session.user.teamId },
      include: { settings: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({
      team: { id: team.id, name: team.name, slug: team.slug },
      settings: team.settings
        ? {
            timezone: team.settings.timezone,
            weeklyReportDay: team.settings.weeklyReportDay,
            weeklyReportTime: team.settings.weeklyReportTime,
            hasTiktokKey: !!team.settings.tiktokApiKey,
            hasInstagramToken: !!team.settings.instagramToken,
            hasYoutubeKey: !!team.settings.youtubeApiKey,
            hasFacebookToken: !!team.settings.facebookToken,
            schedulingUrl: team.settings.schedulingUrl || "",
            creatorWelcomeTemplate: team.settings.creatorWelcomeTemplate || "",
            shoutoutMinViews: team.settings.shoutoutMinViews,
            shoutoutMinPriorPosts: team.settings.shoutoutMinPriorPosts,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();

    // Update team name if provided
    if (body.teamName) {
      await prisma.team.update({
        where: { id: session.user.teamId },
        data: { name: body.teamName },
      });
    }

    // Update settings
    await prisma.teamSettings.upsert({
      where: { teamId: session.user.teamId },
      create: {
        teamId: session.user.teamId,
        timezone: body.timezone,
        tiktokApiKey: body.tiktokApiKey,
        instagramToken: body.instagramToken,
        youtubeApiKey: body.youtubeApiKey,
        facebookToken: body.facebookToken,
        schedulingUrl: body.schedulingUrl,
        creatorWelcomeTemplate: body.creatorWelcomeTemplate,
        ...(Number.isInteger(body.shoutoutMinViews) && {
          shoutoutMinViews: body.shoutoutMinViews,
        }),
        ...(Number.isInteger(body.shoutoutMinPriorPosts) && {
          shoutoutMinPriorPosts: body.shoutoutMinPriorPosts,
        }),
      },
      update: {
        ...(body.timezone !== undefined && { timezone: body.timezone }),
        ...(body.tiktokApiKey !== undefined && { tiktokApiKey: body.tiktokApiKey || null }),
        ...(body.instagramToken !== undefined && { instagramToken: body.instagramToken || null }),
        ...(body.youtubeApiKey !== undefined && { youtubeApiKey: body.youtubeApiKey || null }),
        ...(body.facebookToken !== undefined && { facebookToken: body.facebookToken || null }),
        ...(body.schedulingUrl !== undefined && { schedulingUrl: body.schedulingUrl || null }),
        ...(body.creatorWelcomeTemplate !== undefined && {
          creatorWelcomeTemplate: body.creatorWelcomeTemplate || null,
        }),
        ...(Number.isInteger(body.shoutoutMinViews) && {
          shoutoutMinViews: body.shoutoutMinViews,
        }),
        ...(Number.isInteger(body.shoutoutMinPriorPosts) && {
          shoutoutMinPriorPosts: body.shoutoutMinPriorPosts,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
