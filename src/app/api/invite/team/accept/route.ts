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

  // Create or find the user, then attach them to the team. There are three
  // possible states for the User row:
  //   1. Doesn't exist  → create with the new password
  //   2. Exists, no passwordHash (e.g. signed up via Google previously) → set
  //      the new password so they can sign in with credentials too
  //   3. Exists with a passwordHash → don't touch it; tell the client to use
  //      their existing password (the invite link is just attaching the new
  //      team membership, not resetting their account)
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  let accountAlreadyExisted = false;
  let passwordWasReplaced = false;
  let user;

  if (!existingUser) {
    user = await prisma.user.create({
      data: {
        email: invite.email,
        name: name || null,
        passwordHash,
      },
    });
  } else if (!existingUser.passwordHash) {
    // OAuth-only account — safe to add a password since they had none.
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        ...(name && !existingUser.name ? { name } : {}),
      },
    });
    passwordWasReplaced = true;
  } else {
    user = existingUser;
    accountAlreadyExisted = true;
  }

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

  return NextResponse.json({
    ok: true,
    accountAlreadyExisted,
    passwordWasReplaced,
  });
}
