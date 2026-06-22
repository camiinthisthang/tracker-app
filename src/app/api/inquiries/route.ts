import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasAgencyWideAccess } from "@/lib/auth";
import { notifyNewBrandInquiry } from "@/lib/email/notifications";

// Public endpoint — the brand inquiry form on the marketing site (/brands)
// POSTs here. Mirrors /api/applications: anyone can create, only agency users
// can list.
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validation — company + about are the meaningful fields, name + email let
    // us reply.
    if (!body.name || !body.email || !body.company || !body.about) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const inquiry = await prisma.brandInquiry.create({
      data: {
        name: body.name,
        email: body.email,
        company: body.company,
        link: body.link || null,
        startWindow: body.startWindow || null,
        about: body.about,
      },
    });

    // Fire-and-forget team notification to hey@dropdeck.xyz. Never block (or
    // fail) the public form on email delivery.
    notifyNewBrandInquiry(inquiry).catch((err) =>
      console.error("notifyNewBrandInquiry failed", err)
    );

    return NextResponse.json({ success: true, id: inquiry.id });
  } catch (error) {
    console.error("Create brand inquiry error:", error);
    return NextResponse.json(
      { error: "Failed to submit inquiry" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || !hasAgencyWideAccess(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const inquiries = await prisma.brandInquiry.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(inquiries);
}
