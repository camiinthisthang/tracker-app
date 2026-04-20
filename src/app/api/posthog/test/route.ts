import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/auth";
import { testPostHogConnection } from "@/lib/posthog";

/**
 * Test PostHog creds WITHOUT requiring them to already be saved to
 * TeamSettings. Used by `/onboarding/posthog` before the user hits save.
 */
export async function POST(req: Request) {
  try {
    const session = await getRequiredSession();
    if (session.user.role !== "ADMIN" && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const apiKey =
      typeof body?.posthogApiKey === "string" ? body.posthogApiKey.trim() : "";
    const projectId =
      typeof body?.posthogProjectId === "string"
        ? body.posthogProjectId.trim()
        : "";
    const host =
      typeof body?.posthogHost === "string" && body.posthogHost.trim()
        ? body.posthogHost.trim()
        : null;
    if (!apiKey || !projectId) {
      return NextResponse.json(
        { ok: false, error: "Enter an API key and project ID first" },
        { status: 400 }
      );
    }
    const result = await testPostHogConnection(apiKey, projectId, host);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
