import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ creatorId: string; accountId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { creatorId, accountId } = await params;
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }
  const allowed = await canAccessCreator(prisma, creator, session);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const account = await prisma.creatorAccount.findUnique({
    where: { id: accountId },
  });
  if (!account || account.creatorId !== creatorId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const data: {
    isActive?: boolean;
    isShadowbanned?: boolean;
    note?: string | null;
  } = {};
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.isShadowbanned === "boolean")
    data.isShadowbanned = body.isShadowbanned;
  if ("note" in (body ?? {})) {
    data.note = typeof body.note === "string" ? body.note.trim() || null : null;
  }

  const updated = await prisma.creatorAccount.update({
    where: { id: accountId },
    data,
  });

  return NextResponse.json(updated);
}
