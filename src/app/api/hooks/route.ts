import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";

function trim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "1";
    const stage = searchParams.get("stage"); // "draft" | "published" | null = both
    const campaignId = searchParams.get("campaignId");

    const hooks = await prisma.hook.findMany({
      where: {
        // Agency users see all hooks across teams; client managers only their team's.
        ...(hasAgencyWideAccess(session)
          ? {}
          : { teamId: session.user.teamId }),
        ...(includeArchived ? {} : { isActive: true }),
        ...(stage === "draft" ? { publishedAt: null } : {}),
        ...(stage === "published" ? { publishedAt: { not: null } } : {}),
        ...(campaignId ? { campaignId } : {}),
      },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(hooks);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch hooks" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    if (!hasAgencyWideAccess(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();

    // Accept either the new onScreenText or the legacy text field.
    const onScreenText = trim(body.onScreenText) ?? trim(body.text);
    if (!onScreenText) {
      return NextResponse.json(
        { error: "onScreenText is required" },
        { status: 400 }
      );
    }

    const caption = trim(body.caption);
    const videoDirection = trim(body.videoDirection);
    const prompt = trim(body.prompt);
    const ponchoPrompt = trim(body.ponchoPrompt);
    const inspirationLink = trim(body.inspirationLink);
    const campaignId = trim(body.campaignId);
    const publish = body.publish === true;

    // Resolve teamId. If a campaign was picked, the hook lives under that
    // client team so its managers can see it. Otherwise it stays parked on
    // the user's current team (agency, for Tapmore admins).
    let teamId = session.user.teamId;
    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { teamId: true },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
      teamId = campaign.teamId;
    }

    if (publish && !campaignId) {
      return NextResponse.json(
        { error: "Pick a campaign before publishing" },
        { status: 400 }
      );
    }

    const hook = await prisma.hook.create({
      data: {
        teamId,
        text: onScreenText, // mirror to legacy column for analytics back-compat
        onScreenText,
        caption,
        videoDirection,
        prompt,
        ponchoPrompt,
        inspirationLink,
        campaignId,
        publishedAt: publish ? new Date() : null,
        createdById: session.user.id,
        category: trim(body.category),
      },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(hook, { status: 201 });
  } catch (error) {
    console.error("Create hook error:", error);
    return NextResponse.json(
      { error: "Failed to create hook" },
      { status: 500 }
    );
  }
}
