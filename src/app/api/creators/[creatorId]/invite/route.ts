import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";
import { sendCreatorInvite } from "@/lib/email/creator-invite";
import { BRAND_URL } from "@/lib/brand";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { creatorId } = await params;

    const body = await req.json().catch(() => ({}));
    const sendEmail = body?.sendEmail !== false; // default true

    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: { team: { select: { name: true } } },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    const allowed = await canAccessCreator(prisma, creator, session);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate invite token if not already set
    const token =
      creator.inviteToken || crypto.randomBytes(16).toString("hex");

    if (!creator.inviteToken) {
      await prisma.creator.update({
        where: { id: creatorId },
        data: { inviteToken: token },
      });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get("origin") ||
      BRAND_URL;
    const absoluteInviteUrl = `${origin}/invite/${token}`;

    let emailSent = false;
    let emailError: string | null = null;
    if (sendEmail && creator.email) {
      const result = await sendCreatorInvite({
        to: creator.email,
        creatorName: creator.name,
        teamName: creator.team.name,
        inviteUrl: absoluteInviteUrl,
      });
      emailSent = result.ok;
      if (!result.ok) emailError = result.reason;
    }

    return NextResponse.json({
      inviteToken: token,
      inviteUrl: `/invite/${token}`,
      emailSent,
      emailError,
      email: creator.email,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
