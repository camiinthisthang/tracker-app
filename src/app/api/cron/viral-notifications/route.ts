import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processViralNotificationsForCreator } from "@/lib/notifications/viral";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only process creators who have opted into at least one channel. Narrow
    // the set before iterating so we don't blow per-creator queries on folks
    // who'll short-circuit anyway.
    const creators = await prisma.creator.findMany({
      where: { notificationPrefs: { not: null as unknown as undefined } },
      select: { id: true },
    });

    let fired = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const c of creators) {
      const r = await processViralNotificationsForCreator(c.id);
      fired += r.fired;
      skipped += r.skipped;
      errors.push(...r.errors);
    }

    return NextResponse.json({ ok: true, fired, skipped, errors });
  } catch (err) {
    console.error("viral-notifications cron error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
