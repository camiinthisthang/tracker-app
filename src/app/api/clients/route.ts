import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase letters, numbers, and dashes" },
      { status: 400 }
    );
  }

  const existing = await prisma.team.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "That slug is already in use" },
      { status: 409 }
    );
  }

  const team = await prisma.team.create({
    data: {
      name,
      slug,
      settings: { create: {} },
    },
  });

  return NextResponse.json(team);
}
