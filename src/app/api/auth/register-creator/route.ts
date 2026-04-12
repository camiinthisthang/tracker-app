import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { token, name, email, password } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find creator by invite token
    const creator = await prisma.creator.findUnique({
      where: { inviteToken: token },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check if this creator already has a linked user account
    const existingMembership = await prisma.teamMember.findFirst({
      where: { creatorId: creator.id },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "This creator already has an account linked." },
        { status: 409 }
      );
    }

    // Check if the email is already used
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user + team membership + link to creator
    await prisma.user.create({
      data: {
        name: name || creator.name,
        email,
        passwordHash,
        memberships: {
          create: {
            teamId: creator.teamId,
            role: "CREATOR",
            creatorId: creator.id,
          },
        },
      },
    });

    // Update creator with email and clear invite token
    await prisma.creator.update({
      where: { id: creator.id },
      data: {
        email,
        inviteToken: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Creator register error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
