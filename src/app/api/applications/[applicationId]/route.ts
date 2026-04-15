import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { applicationId } = await params;
    const body = await req.json();

    const existing = await prisma.creatorApplication.findUnique({
      where: { id: applicationId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.creatorApplication.update({
      where: { id: applicationId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.reviewNotes !== undefined && {
          reviewNotes: body.reviewNotes,
        }),
      },
    });

    // Side effect: when an application transitions to APPROVED, promote the
    // applicant into a real Creator record so they show up in the roster and
    // the Apify sync picks up their handles. Idempotent — skips if a Creator
    // with this email already exists.
    let createdCreatorId: string | null = null;
    let inviteToken: string | null = null;
    let createWarning: string | null = null;

    if (
      existing.status !== "APPROVED" &&
      updated.status === "APPROVED"
    ) {
      const email = existing.email.toLowerCase();

      const existingCreator = await prisma.creator.findFirst({
        where: { email },
      });

      if (existingCreator) {
        createdCreatorId = existingCreator.id;
        inviteToken = existingCreator.inviteToken;
        createWarning = "Creator with this email already existed — reused.";
      } else {
        // Creators land in the approving admin's current team. For a solo
        // super-admin agency running a single roster this is correct; once
        // we introduce an "agency pool" concept we'll revisit.
        const teamId = session.user.teamId;
        if (!teamId) {
          createWarning =
            "Couldn't auto-create creator: no team associated with your account.";
        } else {
          const token = crypto.randomBytes(16).toString("hex");
          const tiktokHandle = existing.tiktokHandle
            ? existing.tiktokHandle.trim().replace(/^@+/, "")
            : null;
          const instagramHandle = existing.instagramHandle
            ? existing.instagramHandle.trim().replace(/^@+/, "")
            : null;
          const baseHandle =
            tiktokHandle ||
            instagramHandle ||
            existing.name.toLowerCase().replace(/[^a-z0-9]+/g, ".");

          const creator = await prisma.creator.create({
            data: {
              teamId,
              name: existing.name,
              handle: baseHandle,
              email,
              tiktokHandle,
              instagramHandle,
              inviteToken: token,
              tier: "TRAINING",
              isActive: true,
            },
          });
          createdCreatorId = creator.id;
          inviteToken = token;

          // Drop a pinned welcome message at the top of /creator-tasks so they
          // see the next-step CTA the moment they log in.
          const settings = await prisma.teamSettings.findUnique({
            where: { teamId },
          });
          const template = settings?.creatorWelcomeTemplate;
          if (template) {
            const schedulingUrl =
              settings?.schedulingUrl?.trim() ||
              "(scheduling link not set yet — ask your manager)";
            const body = template.replace(
              /\{\{\s*schedulingUrl\s*\}\}/g,
              schedulingUrl
            );
            await prisma.creatorMessage.create({
              data: {
                creatorId: creator.id,
                type: "ANNOUNCEMENT",
                title: "Welcome — start here",
                body,
                isPinned: true,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({
      ...updated,
      createdCreatorId,
      inviteToken,
      createWarning,
    });
  } catch (err) {
    console.error("application PATCH failed", err);
    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    );
  }
}
