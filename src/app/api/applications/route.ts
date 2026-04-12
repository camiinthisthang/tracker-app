import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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

    if (!body.canCommit) {
      return NextResponse.json(
        { error: "You must confirm you can commit to one shoot day per week." },
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
        canCommit: body.canCommit,
      },
    });

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applications = await prisma.creatorApplication.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(applications);
}
