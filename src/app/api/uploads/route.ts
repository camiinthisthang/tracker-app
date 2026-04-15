import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("campaignId");

    // Tenant-check via creator so onboarding uploads (campaignId = null) are
    // still visible.
    const where: Record<string, unknown> = {
      creator: { teamId: session.user.teamId },
    };
    if (campaignId) where.campaignId = campaignId;
    if (session.user.role === "CREATOR" && session.user.creatorId) {
      where.creatorId = session.user.creatorId;
    }

    const uploads = await prisma.upload.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, handle: true } },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(uploads);
  } catch {
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();

    const category: "CONTENT" | "ONBOARDING_DOCS" =
      body.category === "ONBOARDING_DOCS" ? "ONBOARDING_DOCS" : "CONTENT";

    // Onboarding uploads don't belong to a campaign; regular content uploads do.
    if (category === "CONTENT") {
      const campaign = await prisma.campaign.findFirst({
        where: { id: body.campaignId, teamId: session.user.teamId },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campaign not found" },
          { status: 404 }
        );
      }
    }

    // Derive the creator ID for the logged-in creator rather than trusting the
    // client payload. Managers can still pass creatorId explicitly.
    let creatorId = body.creatorId as string | undefined;
    if (session.user.role === "CREATOR" && session.user.creatorId) {
      creatorId = session.user.creatorId;
    }
    if (!creatorId) {
      return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    }

    const upload = await prisma.upload.create({
      data: {
        campaignId: category === "CONTENT" ? body.campaignId : null,
        creatorId,
        category,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        fileSize: body.fileSize || 0,
      },
    });

    return NextResponse.json(upload, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create upload" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getRequiredSession();
    const body = await req.json();

    const upload = await prisma.upload.findFirst({
      where: {
        id: body.uploadId,
        creator: { teamId: session.user.teamId },
      },
    });
    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const updated = await prisma.upload.update({
      where: { id: body.uploadId },
      data: {
        status: body.status,
        feedback: body.feedback,
        reviewedAt: body.status !== "PENDING" ? new Date() : null,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update upload" }, { status: 500 });
  }
}
