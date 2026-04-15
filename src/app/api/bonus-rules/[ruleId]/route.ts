import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { ruleId } = await params;
    const body = await req.json();

    const where = session.user.isSuperAdmin
      ? { id: ruleId }
      : { id: ruleId, teamId: session.user.teamId };
    const existing = await prisma.bonusRule.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.label === "string" && body.label.trim().length > 0) {
      data.label = body.label.trim();
    }
    if (body.threshold !== undefined) {
      const n = Number(body.threshold);
      if (Number.isFinite(n) && n > 0) data.threshold = Math.floor(n);
    }
    if (body.amountUsd !== undefined) {
      const n = Number(body.amountUsd);
      if (Number.isFinite(n) && n >= 0) data.amountUsd = n;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await prisma.bonusRule.update({
      where: { id: ruleId },
      data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update bonus rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { ruleId } = await params;
    const where = session.user.isSuperAdmin
      ? { id: ruleId }
      : { id: ruleId, teamId: session.user.teamId };
    const existing = await prisma.bonusRule.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.bonusRule.delete({ where: { id: ruleId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete bonus rule" },
      { status: 500 }
    );
  }
}
