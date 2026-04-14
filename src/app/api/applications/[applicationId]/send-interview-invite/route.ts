import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { resend, FROM_EMAIL, isEmailConfigured } from "@/lib/email/resend";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const session = await getSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isEmailConfigured() || !resend) {
    return NextResponse.json(
      {
        error:
          "Email is not configured. Set RESEND_API_KEY in your environment.",
      },
      { status: 500 }
    );
  }

  const { applicationId } = await params;
  const body = await req.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject : "";
  const htmlBody = typeof body?.html === "string" ? body.html : "";
  const textBody = typeof body?.text === "string" ? body.text : "";
  const markReviewing = body?.markReviewing !== false; // default true

  if (!subject || (!htmlBody && !textBody)) {
    return NextResponse.json(
      { error: "Subject and body are required" },
      { status: 400 }
    );
  }

  const application = await prisma.creatorApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: application.email,
      subject,
      html: htmlBody || undefined,
      text: textBody || undefined,
    });

    if (error) {
      console.error("Resend error", error);
      return NextResponse.json(
        { error: error.message || "Email send failed" },
        { status: 500 }
      );
    }

    if (markReviewing && application.status !== "REVIEWING") {
      await prisma.creatorApplication.update({
        where: { id: applicationId },
        data: { status: "REVIEWING" },
      });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("send-interview-invite threw", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
