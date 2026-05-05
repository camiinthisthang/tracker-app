import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";

function trim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ hookId: string }> }
) {
  try {
    const session = await getRequiredSession();
    if (!hasAgencyWideAccess(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { hookId } = await params;
    const body = await req.json();

    const existing = await prisma.hook.findUnique({ where: { id: hookId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // onScreenText is the new source of truth; keep `text` mirrored for the
    // legacy analytics path.
    if (body.onScreenText !== undefined || body.text !== undefined) {
      const next = trim(body.onScreenText) ?? trim(body.text);
      if (!next) {
        return NextResponse.json(
          { error: "onScreenText cannot be empty" },
          { status: 400 }
        );
      }
      data.onScreenText = next;
      data.text = next;
    }
    if (body.caption !== undefined) data.caption = trim(body.caption);
    if (body.videoDirection !== undefined)
      data.videoDirection = trim(body.videoDirection);
    if (body.prompt !== undefined) data.prompt = trim(body.prompt);
    if (body.category !== undefined) data.category = trim(body.category);
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    // Re-attach to a different campaign (or detach). When the campaign
    // changes, also move the hook's teamId to match the new campaign's team
    // so client-manager visibility stays consistent.
    if (body.campaignId !== undefined) {
      const nextCampaignId = trim(body.campaignId);
      if (nextCampaignId === null) {
        data.campaignId = null;
      } else {
        const campaign = await prisma.campaign.findUnique({
          where: { id: nextCampaignId },
          select: { id: true, teamId: true },
        });
        if (!campaign) {
          return NextResponse.json(
            { error: "Campaign not found" },
            { status: 404 }
          );
        }
        data.campaignId = campaign.id;
        data.teamId = campaign.teamId;
      }
    }

    // Publish toggle: true = stamp publishedAt now, false = revert to draft.
    if (typeof body.publish === "boolean") {
      if (body.publish) {
        const targetCampaignId =
          (data.campaignId as string | null | undefined) ?? existing.campaignId;
        if (!targetCampaignId) {
          return NextResponse.json(
            { error: "Pick a campaign before publishing" },
            { status: 400 }
          );
        }
        data.publishedAt = new Date();
      } else {
        data.publishedAt = null;
      }
    }

    const updated = await prisma.hook.update({
      where: { id: hookId },
      data,
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update hook error:", error);
    return NextResponse.json(
      { error: "Failed to update hook" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ hookId: string }> }
) {
  try {
    const session = await getRequiredSession();
    if (!hasAgencyWideAccess(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { hookId } = await params;

    const existing = await prisma.hook.findUnique({ where: { id: hookId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.hook.delete({ where: { id: hookId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete hook error:", error);
    return NextResponse.json(
      { error: "Failed to delete hook" },
      { status: 500 }
    );
  }
}
