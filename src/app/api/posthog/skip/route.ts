import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

/**
 * Record that this team's admin explicitly skipped the PostHog onboarding
 * step. Prevents us from bouncing them through the same screen again on
 * future logins. Blank creds stay null so they can still finish setup later
 * from the client settings page.
 */
export async function POST() {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.teamSettings.upsert({
      where: { teamId: session.user.teamId },
      create: {
        teamId: session.user.teamId,
        posthogOnboardingSkippedAt: new Date(),
      },
      update: { posthogOnboardingSkippedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
