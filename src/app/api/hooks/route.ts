import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "1";

    const hooks = await prisma.hook.findMany({
      where: {
        teamId: session.user.teamId,
        ...(includeArchived ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(hooks);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch hooks" },
      { status: 500 }
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
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const hook = await prisma.hook.create({
      data: {
        teamId: session.user.teamId,
        text,
        category:
          typeof body.category === "string" && body.category.trim().length > 0
            ? body.category.trim()
            : null,
      },
    });
    return NextResponse.json(hook, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create hook" },
      { status: 500 }
    );
  }
}
