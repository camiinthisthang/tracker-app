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
    name?: string;
    email?: string | null;
    tier?: "TRAINING" | "BRONZE" | "SILVER" | "GOLD";
    isActive?: boolean;
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

  const updated = await prisma.creator.update({
    where: { id: creatorId },
    data,
  });

  return NextResponse.json(updated);
}
