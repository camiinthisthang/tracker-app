import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId } = await params;

  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    tiktokHandle?: string | null;
    instagramHandle?: string | null;
    youtubeHandle?: string | null;
    name?: string;
    email?: string | null;
    tier?: "TRAINING" | "BRONZE" | "SILVER" | "GOLD";
    isActive?: boolean;
    isShadowbanned?: boolean;
  } = {};

  if ("tiktokHandle" in body) {
    data.tiktokHandle =
      typeof body.tiktokHandle === "string"
        ? body.tiktokHandle.trim().replace(/^@+/, "") || null
        : null;
  }
  if ("instagramHandle" in body) {
    data.instagramHandle =
      typeof body.instagramHandle === "string"
        ? body.instagramHandle.trim().replace(/^@+/, "") || null
        : null;
  }
  if ("youtubeHandle" in body) {
    data.youtubeHandle =
      typeof body.youtubeHandle === "string"
        ? body.youtubeHandle.trim().replace(/^@+/, "") || null
        : null;
  }
  if ("name" in body && typeof body.name === "string") {
    data.name = body.name.trim();
  }
  if ("email" in body) {
    data.email =
      typeof body.email === "string" ? body.email.trim() || null : null;
  }
  if (
    "tier" in body &&
    ["TRAINING", "BRONZE", "SILVER", "GOLD"].includes(body.tier)
  ) {
    data.tier = body.tier;
  }
  if ("isActive" in body && typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }
  if ("isShadowbanned" in body && typeof body.isShadowbanned === "boolean") {
    data.isShadowbanned = body.isShadowbanned;
  }

  const updated = await prisma.creator.update({
    where: { id: creatorId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only super admins can delete creators" },
      { status: 403 }
    );
  }

  const { creatorId } = await params;
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: { teamMember: { select: { userId: true } } },
  });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // Delete the linked User first (cascades TeamMember/Session/Account) so the
  // creator login is gone, then the Creator row (cascades Posts, Tasks,
  // CreatorMessage, Upload, CampaignCreator, ViralNotification,
  // CreatorAttribution, CreatorEarning via the schema).
  await prisma.$transaction(async (tx) => {
    if (creator.teamMember?.userId) {
      await tx.user.delete({ where: { id: creator.teamMember.userId } });
    }
    await tx.creator.delete({ where: { id: creatorId } });
  });

  return NextResponse.json({ success: true });
}
