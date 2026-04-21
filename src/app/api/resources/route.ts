import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    // Super-admins can query any team's resources by passing ?teamId=
    const teamId =
      session.user.isSuperAdmin && searchParams.get("teamId")
        ? (searchParams.get("teamId") as string)
        : session.user.teamId;

    const resources = await prisma.teamResource.findMany({
      where: { teamId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(resources);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const title =
      typeof body.title === "string" ? body.title.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!title || !url) {
      return NextResponse.json(
        { error: "Title and URL are required" },
        { status: 400 },
      );
    }
    const teamId =
      session.user.isSuperAdmin &&
      typeof body.teamId === "string" &&
      body.teamId
        ? body.teamId
        : session.user.teamId;

    const resource = await prisma.teamResource.create({
      data: {
        teamId,
        title,
        url,
        description:
          typeof body.description === "string" && body.description.trim()
            ? body.description.trim()
            : null,
        category:
          typeof body.category === "string" && body.category.trim()
            ? body.category.trim()
            : null,
      },
    });
    return NextResponse.json(resource, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 },
    );
  }
}
