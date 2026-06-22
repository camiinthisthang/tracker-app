import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAgencyWideAccess } from "@/lib/auth";
import { notifyNewCreatorApplication } from "@/lib/email/notifications";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validation
    if (!body.name || !body.email || !body.about) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const application = await prisma.creatorApplication.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        location: body.location || null,
        instagramHandle: body.instagramHandle || null,
        tiktokHandle: body.tiktokHandle || null,
        about: body.about,
        videoUrls: body.videoUrls || [],
        canCommit: body.canCommit ?? true,
      },
    });

    // Fire-and-forget team notification to hey@dropdeck.xyz. Never block the
    // public form on email delivery.
    notifyNewCreatorApplication(application).catch((err) =>
      console.error("notifyNewCreatorApplication failed", err)
    );

    return NextResponse.json({ success: true, id: application.id });
  } catch (error) {
    console.error("Create application error:", error);
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Hardened: applicant PII (name, email, phone, location) must only be
  // readable by agency users, not any logged-in account (e.g. a creator).
  const session = await getSession();
  if (!session || !hasAgencyWideAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applications = await prisma.creatorApplication.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(applications);
}
