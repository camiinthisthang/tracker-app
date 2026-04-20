import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { findEmailConflict } from "@/lib/email-conflict";

export async function POST(req: Request) {
  try {
    const { name, email, password, teamName } = await req.json();

    if (!email || !password || !teamName) {
      return NextResponse.json(
        { error: "Email, password, and team name are required" },
        { status: 400 }
      );
    }

    const conflict = await findEmailConflict(email, {
      check: ["user", "creator"],
    });
    if (conflict) {
      return NextResponse.json(
        {
          error: conflict.message,
          suggestion:
            conflict.table === "user"
              ? "Sign in with your existing password instead of registering again."
              : conflict.suggestion,
          conflict: { table: conflict.table, existingId: conflict.existingId },
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const slug = teamName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        memberships: {
          create: {
            role: "ADMIN",
            team: {
              create: {
                name: teamName,
                slug: `${slug}-${Date.now().toString(36)}`,
                settings: {
                  create: {},
                },
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { team: true },
        },
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      teamId: user.memberships[0].teamId,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
