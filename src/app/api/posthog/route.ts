import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth";
import { testPostHogConnection, syncPostHogForTeam } from "@/lib/posthog";

export async function GET() {
  try {
    const session = await getRequiredSession();
    const settings = await prisma.teamSettings.findUnique({
      where: { teamId: session.user.teamId },
      select: {
        posthogApiKey: true,
        posthogProjectId: true,
        posthogHost: true,
      },
    });
    return NextResponse.json({
      hasApiKey: Boolean(settings?.posthogApiKey),
      posthogProjectId: settings?.posthogProjectId ?? null,
      posthogHost: settings?.posthogHost ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const teamId =
      session.user.isSuperAdmin && typeof body.teamId === "string" && body.teamId
        ? body.teamId
        : session.user.teamId;

    const data: Record<string, unknown> = {};
    if (typeof body.posthogApiKey === "string") {
      data.posthogApiKey =
        body.posthogApiKey.trim().length > 0 ? body.posthogApiKey.trim() : null;
    }
    if (typeof body.posthogProjectId === "string") {
      data.posthogProjectId =
        body.posthogProjectId.trim().length > 0
          ? body.posthogProjectId.trim()
          : null;
    }
    if (typeof body.posthogHost === "string") {
      data.posthogHost =
        body.posthogHost.trim().length > 0 ? body.posthogHost.trim() : null;
    }

    const settings = await prisma.teamSettings.upsert({
      where: { teamId },
      create: { teamId, ...data },
      update: data,
    });
    return NextResponse.json({
      hasApiKey: Boolean(settings.posthogApiKey),
      posthogProjectId: settings.posthogProjectId,
      posthogHost: settings.posthogHost,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save PostHog config" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Body actions: { action: 'test' | 'sync', teamId? }
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const teamId =
      session.user.isSuperAdmin && typeof body.teamId === "string" && body.teamId
        ? body.teamId
        : session.user.teamId;

    const settings = await prisma.teamSettings.findUnique({
      where: { teamId },
    });
    if (!settings?.posthogApiKey || !settings?.posthogProjectId) {
      return NextResponse.json(
        { ok: false, error: "PostHog not configured" },
        { status: 400 }
      );
    }

    if (body.action === "test") {
      const result = await testPostHogConnection(
        settings.posthogApiKey,
        settings.posthogProjectId,
        settings.posthogHost
      );
      return NextResponse.json(result);
    }
    if (body.action === "sync") {
      const result = await syncPostHogForTeam(teamId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
