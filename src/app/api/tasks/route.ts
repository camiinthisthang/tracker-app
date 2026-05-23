import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, hasAgencyWideAccess } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);

    const campaignId = searchParams.get("campaignId");
    const creatorId = searchParams.get("creatorId");

    // Tenant-check via the creator's team so we still pick up onboarding tasks
    // (campaignId = null). The old campaign-based check filtered them out.
    // Agency users see tasks across every client team.
    const where: Record<string, unknown> = hasAgencyWideAccess(session)
      ? {}
      : { creator: { teamId: session.user.teamId } };

    if (campaignId) where.campaignId = campaignId;
    if (creatorId) where.creatorId = creatorId;

    if (session.user.role === "CREATOR" && session.user.creatorId) {
      where.creatorId = session.user.creatorId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, handle: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getRequiredSession();
    const { taskId, isCompleted } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // Verify task belongs to user's team (via creator, since onboarding tasks
    // have no campaign). Agency users can update tasks for any client.
    const task = await prisma.task.findFirst({
      where: hasAgencyWideAccess(session)
        ? { id: taskId }
        : { id: taskId, creator: { teamId: session.user.teamId } },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
