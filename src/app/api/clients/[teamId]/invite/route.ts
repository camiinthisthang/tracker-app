import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { findEmailConflict } from "@/lib/email-conflict";
import { sendManagerInvite } from "@/lib/email/manager-invite";
import { BRAND_URL } from "@/lib/brand";

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
  // "agency" = inviting a fellow DropDeck admin. "client" = inviting a client-
  // side manager. Only affects email copy + dialog framing; the DB row is the
  // same TeamInvite(role=ADMIN) on the given teamId either way.
  const variant: "client" | "agency" =
    body?.variant === "agency" ? "agency" : "client";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Creator / open-application conflicts block a manager invite — the email
  // is already "claimed" by a different kind of account and the invite would
  // create a confusing second one. A preexisting User is NOT a block: the
  // accept-invite flow gracefully attaches an existing user to the new team.
  const conflict = await findEmailConflict(email, {
    check: ["creator", "application"],
  });
  if (conflict) {
    return NextResponse.json(
      {
        error: conflict.message,
        suggestion: conflict.suggestion,
        conflict: { table: conflict.table, existingId: conflict.existingId },
      },
      { status: 409 }
    );
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
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get("origin") ||
    BRAND_URL;
  const inviteUrl = `${origin}/invite/team/${token}`;

  // Fire the branded invite email via Resend. Don't block the response on
  // send failure — the caller always gets the link back and can copy/paste
  // manually if delivery fails.
  const inviterName =
    typeof session.user.name === "string" ? session.user.name : null;
  const emailResult = await sendManagerInvite({
    to: email,
    teamName: team.name,
    inviteUrl,
    inviterName,
    variant,
  });

  return NextResponse.json({
    token,
    url: inviteUrl,
    expiresAt,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.reason,
  });
}
