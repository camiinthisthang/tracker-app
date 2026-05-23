import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    // Agency users see notification rules across every client team.
    const rules = await prisma.notificationRule.findMany({
      where: {
        ...(hasAgencyWideAccess(session)
          ? {}
          : { campaign: { teamId: session.user.teamId } }),
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(rules);
  } catch {
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();

    // Verify campaign belongs to team. Agency users may target any campaign.
    const campaign = await prisma.campaign.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: body.campaignId }
        : { id: body.campaignId, teamId: session.user.teamId },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const rule = await prisma.notificationRule.create({
      data: {
        campaignId: body.campaignId,
        type: body.type,
        name: body.name,
        description: body.description,
        webhookUrl: body.webhookUrl,
        thresholdMetric: body.thresholdMetric,
        thresholdValue: body.thresholdValue,
        isEnabled: body.isEnabled ?? true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();

    const rule = await prisma.notificationRule.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: body.ruleId }
        : { id: body.ruleId, campaign: { teamId: session.user.teamId } },
    });
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updated = await prisma.notificationRule.update({
      where: { id: body.ruleId },
      data: {
        ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
        ...(body.webhookUrl && { webhookUrl: body.webhookUrl }),
        ...(body.thresholdValue !== undefined && { thresholdValue: body.thresholdValue }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("ruleId");

    if (!ruleId) {
      return NextResponse.json({ error: "ruleId required" }, { status: 400 });
    }

    const rule = await prisma.notificationRule.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: ruleId }
        : { id: ruleId, campaign: { teamId: session.user.teamId } },
    });
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await prisma.notificationRule.delete({ where: { id: ruleId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
