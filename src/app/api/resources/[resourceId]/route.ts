import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { resourceId } = await params;
    const existing = await prisma.teamResource.findUnique({
      where: { id: resourceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      !session.user.isSuperAdmin &&
      existing.teamId !== session.user.teamId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.url === "string") data.url = body.url.trim();
    if ("description" in body) {
      data.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null;
    }
    if ("category" in body) {
      data.category =
        typeof body.category === "string" && body.category.trim()
          ? body.category.trim()
          : null;
    }
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

    const updated = await prisma.teamResource.update({
      where: { id: resourceId },
      data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { resourceId } = await params;
    const existing = await prisma.teamResource.findUnique({
      where: { id: resourceId },
      select: { teamId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      !session.user.isSuperAdmin &&
      existing.teamId !== session.user.teamId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.teamResource.delete({ where: { id: resourceId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
