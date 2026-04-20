import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Creator-self endpoint for updating their own TikTok + Instagram handles.
 * Kept separate from the admin PATCH at /api/creators/[id] so creators can
 * only touch these two fields on their own record — nothing else.
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  const creatorId = session?.user?.creatorId;
  if (!creatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const clean = (v: unknown) =>
    typeof v === "string" ? v.trim().replace(/^@+/, "") || null : null;

  const data: { tiktokHandle?: string | null; instagramHandle?: string | null } =
    {};
  if ("tiktokHandle" in body) data.tiktokHandle = clean(body.tiktokHandle);
  if ("instagramHandle" in body)
    data.instagramHandle = clean(body.instagramHandle);

  const updated = await prisma.creator.update({
    where: { id: creatorId },
    data,
    select: { id: true, tiktokHandle: true, instagramHandle: true },
  });

  return NextResponse.json(updated);
}
