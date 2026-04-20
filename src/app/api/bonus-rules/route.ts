import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

const VALID_TRIGGERS = new Set([
  "VIEW_THRESHOLD",
  "VIRAL_COUNT",
  "REFERRAL_COUNT",
  "USER_DOWNLOAD",
  "USER_PAID_PLAN",
]);

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    // Super-admins can query any team's rules by passing ?teamId=
    const teamId =
      session.user.isSuperAdmin && searchParams.get("teamId")
        ? (searchParams.get("teamId") as string)
        : session.user.teamId;

    const rules = await prisma.bonusRule.findMany({
      where: { teamId },
      orderBy: [{ isActive: "desc" }, { threshold: "asc" }],
    });
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch bonus rules" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    if (
      typeof body.trigger !== "string" ||
      !VALID_TRIGGERS.has(body.trigger)
    ) {
      return NextResponse.json({ error: "Invalid trigger" }, { status: 400 });
    }
    const threshold = Number(body.threshold);
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return NextResponse.json({ error: "Invalid threshold" }, { status: 400 });
    }
    if (!Number.isFinite(amountUsd) || amountUsd < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const label =
      typeof body.label === "string" && body.label.trim().length > 0
        ? body.label.trim()
        : "Bonus";
    const teamId =
      session.user.isSuperAdmin && typeof body.teamId === "string" && body.teamId
        ? body.teamId
        : session.user.teamId;

    const rule = await prisma.bonusRule.create({
      data: {
        teamId,
        trigger: body.trigger as "VIEW_THRESHOLD" | "VIRAL_COUNT" | "REFERRAL_COUNT" | "USER_DOWNLOAD" | "USER_PAID_PLAN",
        threshold: Math.floor(threshold),
        amountUsd,
        label,
      },
    });
    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create bonus rule" },
      { status: 500 }
    );
  }
}
