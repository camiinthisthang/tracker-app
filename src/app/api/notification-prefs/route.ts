import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const session = await getRequiredSession();
    const creatorId = session.user.creatorId;
    if (!creatorId) {
      return NextResponse.json({ error: "No creator linked" }, { status: 400 });
    }
    const body = await req.json();
    const prefs: Record<string, unknown> = {};
    if (typeof body.viralEmail === "boolean") prefs.viralEmail = body.viralEmail;
    if (typeof body.viralSms === "boolean") prefs.viralSms = body.viralSms;
    if (typeof body.phoneNumber === "string") {
      prefs.phoneNumber =
        body.phoneNumber.trim().length > 0 ? body.phoneNumber.trim() : null;
    }
    if (body.threshold !== undefined) {
      const n = Number(body.threshold);
      prefs.threshold = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }

    const existing = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: { notificationPrefs: true },
    });
    const merged = {
      ...(typeof existing?.notificationPrefs === "object" &&
      existing?.notificationPrefs !== null
        ? (existing.notificationPrefs as Record<string, unknown>)
        : {}),
      ...prefs,
    };

    await prisma.creator.update({
      where: { id: creatorId },
      data: { notificationPrefs: merged as Prisma.InputJsonValue },
    });
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
