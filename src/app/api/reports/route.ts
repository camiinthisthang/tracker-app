import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    // Agency users see report configs across every client team.
    const configs = await prisma.weeklyReportConfig.findMany({
      where: {
        ...(hasAgencyWideAccess(session)
          ? {}
          : { campaign: { teamId: session.user.teamId } }),
        ...(campaignId ? { campaignId } : {}),
      },
      include: {
        campaign: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(configs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();

    const campaign = await prisma.campaign.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: body.campaignId }
        : { id: body.campaignId, teamId: session.user.teamId },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Check if config already exists
    const existing = await prisma.weeklyReportConfig.findFirst({
      where: { campaignId: body.campaignId },
    });

    if (existing) {
      const updated = await prisma.weeklyReportConfig.update({
        where: { id: existing.id },
        data: {
          isEnabled: body.isEnabled ?? existing.isEnabled,
          recipients: body.recipients ?? existing.recipients,
          publicSlug: body.generatePublicLink
            ? crypto.randomBytes(8).toString("hex")
            : existing.publicSlug,
        },
      });
      return NextResponse.json(updated);
    }

    const config = await prisma.weeklyReportConfig.create({
      data: {
        campaignId: body.campaignId,
        isEnabled: body.isEnabled ?? true,
        recipients: body.recipients ?? [],
        publicSlug: body.generatePublicLink
          ? crypto.randomBytes(8).toString("hex")
          : null,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save report config" }, { status: 500 });
  }
}
