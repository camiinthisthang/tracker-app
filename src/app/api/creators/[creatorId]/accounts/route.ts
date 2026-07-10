import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import type { Platform } from "@/generated/prisma/enums";

const PLATFORMS: Platform[] = ["TIKTOK", "INSTAGRAM", "YOUTUBE"];

export async function POST(
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
  const platform = body?.platform as Platform | undefined;
  const handle =
    typeof body?.handle === "string"
      ? body.handle.trim().replace(/^@+/, "")
      : "";
  const note = typeof body?.note === "string" ? body.note.trim() || null : null;
  const campaignId =
    typeof body?.campaignId === "string" && body.campaignId ? body.campaignId : null;

  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (!handle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }
  if (campaignId) {
    const onCampaign = await prisma.campaignCreator.findFirst({
      where: { campaignId, creatorId },
      select: { id: true },
    });
    if (!onCampaign) {
      return NextResponse.json(
        { error: "Creator is not assigned to that campaign" },
        { status: 400 }
      );
    }
  }

  const account = await prisma.creatorAccount.upsert({
    where: {
      creatorId_platform_handle: { creatorId, platform, handle },
    },
    create: { creatorId, platform, handle, note, campaignId },
    update: { isActive: true, note: note ?? undefined, campaignId },
  });

  return NextResponse.json(account);
}
