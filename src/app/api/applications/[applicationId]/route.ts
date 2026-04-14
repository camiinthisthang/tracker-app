import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { applicationId } = await params;
    const body = await req.json();

    const updated = await prisma.creatorApplication.update({
      where: { id: applicationId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.reviewNotes !== undefined && {
          reviewNotes: body.reviewNotes,
        }),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    );
  }
}
