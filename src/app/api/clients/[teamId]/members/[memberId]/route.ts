import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { teamId, memberId } = await params;

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, teamId: true, userId: true, role: true },
  });

  if (!member || member.teamId !== teamId) {
    return NextResponse.json(
      { error: "Member not found on this team" },
      { status: 404 }
    );
  }

  // Block removing yourself — would lock you out of this team and is almost
  // never the actual intent. Use SQL if it ever genuinely is.
  if (member.userId === session.user.id) {
    return NextResponse.json(
      { error: "Use a different account to remove yourself from a team" },
      { status: 400 }
    );
  }

  // CREATOR memberships have a unique creator link — we don't want admins
  // accidentally orphaning a creator's portal access from this UI. The Manager
  // delete here is for ADMIN/MEMBER rows only.
  if (member.role === "CREATOR") {
    return NextResponse.json(
      {
        error:
          "This is a creator's portal access. Manage from the creator's profile, not from the client managers list.",
      },
      { status: 400 }
    );
  }

  await prisma.teamMember.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}
