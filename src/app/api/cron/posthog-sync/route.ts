import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPostHogForTeam } from "@/lib/posthog";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const teamsWithPostHog = await prisma.teamSettings.findMany({
      where: {
        posthogApiKey: { not: null },
        posthogProjectId: { not: null },
      },
      select: { teamId: true },
    });

    const results = [];
    for (const { teamId } of teamsWithPostHog) {
      const r = await syncPostHogForTeam(teamId);
      results.push({ teamId, ...r });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("posthog-sync cron error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
