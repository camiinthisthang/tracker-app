import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { canAccessCreator } from "@/lib/visibility";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  try {
    const session = await getRequiredSession();
    const { creatorId } = await params;

    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
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
