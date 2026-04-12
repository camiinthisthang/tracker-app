import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getRequiredSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getRequiredSession();
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return NextResponse.json(
        { error: "TikTok client key not configured" },
        { status: 500 }
      );
    }

    const redirectUri =
      process.env.TIKTOK_REDIRECT_URI ||
      `${req.headers.get("origin") || "https://viewtrackr.com"}/api/auth/tiktok/callback`;

    // Generate CSRF state — bind to team + optional creatorId
    const state = crypto.randomBytes(16).toString("hex");
    const statePayload = JSON.stringify({
      state,
      teamId: session.user.teamId,
      creatorId: creatorId || session.user.creatorId || null,
    });

    // Store state in a short-lived cookie
    const cookieStore = await cookies();
    cookieStore.set("tiktok_oauth_state", statePayload, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Required scopes for Display API + Login Kit
    const scopes = [
      "user.info.basic",
      "user.info.profile",
      "user.info.stats",
      "video.list",
    ].join(",");

    const params = new URLSearchParams({
      client_key: clientKey,
      scope: scopes,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("TikTok OAuth initiate error:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth" },
      { status: 500 }
    );
  }
}
