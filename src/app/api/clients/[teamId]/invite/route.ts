import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { teamId } = await params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.teamInvite.create({
    data: {
      teamId,
      email,
      role: "ADMIN",
      token,
      expiresAt,
    },
  });

  const origin =
    req.headers.get("origin") ||
    (process.env.NEXT_PUBLIC_APP_URL ?? "https://viewtrackr.com");

  return NextResponse.json({
    token,
    url: `${origin}/invite/team/${token}`,
    expiresAt,
  });
}
