import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Invalid invite data" },
      { status: 400 }
    );
  }

  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invite is invalid or expired" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create or find the user, then attach them to the team. If a user already
  // exists with this email (e.g. they manage another client) we just add a new
  // TeamMember and leave their password alone.
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: invite.email,
        name: name || null,
        passwordHash,
      },
    }));

  // Make sure they aren't already a member of this team
  const alreadyMember = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: invite.teamId } },
  });

  if (!alreadyMember) {
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId: invite.teamId,
        role: invite.role,
      },
    });
  }

  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
