import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";

/**
 * Bulk-unpublish every hook the caller can see. Moves them back to the
 * Workshop tab without touching the hook content — same model as clicking
 * "Move back to workshop" on each row, just batched.
 *
 * Scope: agency users (super admin / agency manager) hit every hook;
 * client managers only their team's. Creators are not allowed.
 */
export async function POST() {
  const session = await getRequiredSession();
  if (session.user.role === "CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teamScope = hasAgencyWideAccess(session)
    ? {}
    : { teamId: session.user.teamId };

  const result = await prisma.hook.updateMany({
    where: {
      ...teamScope,
      publishedAt: { not: null },
    },
    data: { publishedAt: null },
  });

  return NextResponse.json({ updatedCount: result.count });
}
