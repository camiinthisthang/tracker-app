import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ hookId: string }> }
) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { hookId } = await params;
    const body = await req.json();

    const existing = await prisma.hook.findFirst({
      where: { id: hookId, teamId: session.user.teamId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.text === "string" && body.text.trim().length > 0) {
      data.text = body.text.trim();
    }
    if (body.category !== undefined) {
      data.category =
        typeof body.category === "string" && body.category.trim().length > 0
          ? body.category.trim()
          : null;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await prisma.hook.update({
      where: { id: hookId },
      data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update hook" },
      { status: 500 }
    );
  }
}
