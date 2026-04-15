import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; inviteId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { teamId, inviteId } = await params;

  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, teamId: true },
  });

  if (!invite || invite.teamId !== teamId) {
    return NextResponse.json(
      { error: "Invite not found on this team" },
      { status: 404 }
    );
  }

  await prisma.teamInvite.delete({ where: { id: inviteId } });

  return NextResponse.json({ ok: true });
}
