import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAgencyWideAccess } from "@/lib/auth";

// Update a brand inquiry's pipeline status (NEW → CONTACTED → WON / ARCHIVED)
// or attach review notes. Agency-only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ inquiryId: string }> }
) {
  const session = await getSession();
  if (!session || !hasAgencyWideAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { inquiryId } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.brandInquiry.findUnique({
    where: { id: inquiryId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const updated = await prisma.brandInquiry.update({
    where: { id: inquiryId },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.reviewNotes !== undefined && { reviewNotes: body.reviewNotes }),
    },
  });

  return NextResponse.json(updated);
}
