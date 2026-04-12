import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { creatorId } = await params;

    const creator = await prisma.creator.findFirst({
      where: { id: creatorId, teamId: session.user.teamId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
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

    return NextResponse.json({
      inviteToken: token,
      inviteUrl: `/invite/${token}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}
