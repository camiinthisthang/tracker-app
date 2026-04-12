import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const origin = req.headers.get("origin") || "https://viewtrackr.com";

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/profile?error=${encodeURIComponent(errorParam)}`
    );
  }

  if (!code || !returnedState) {
    return NextResponse.redirect(
      `${origin}/profile?error=missing_code_or_state`
    );
  }

  // Verify state
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("tiktok_oauth_state");
  if (!stateCookie) {
    return NextResponse.redirect(`${origin}/profile?error=invalid_state`);
  }

  let statePayload: { state: string; teamId: string; creatorId: string | null };
  try {
    statePayload = JSON.parse(stateCookie.value);
  } catch {
    return NextResponse.redirect(`${origin}/profile?error=invalid_state`);
  }

  if (statePayload.state !== returnedState) {
    return NextResponse.redirect(`${origin}/profile?error=state_mismatch`);
  }

  cookieStore.delete("tiktok_oauth_state");

  const clientKey = process.env.TIKTOK_CLIENT_KEY!;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI ||
    `${origin}/api/auth/tiktok/callback`;

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const {
      access_token,
      refresh_token,
      expires_in,
      open_id,
    } = tokenRes.data;

    if (!access_token) {
      console.error("No access token in response:", tokenRes.data);
      return NextResponse.redirect(
        `${origin}/profile?error=token_exchange_failed`
      );
    }

    // Fetch user info
    const userInfoRes = await axios.get(
      "https://open.tiktokapis.com/v2/user/info/",
      {
        params: {
          fields: "open_id,union_id,avatar_url,display_name,username",
        },
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const userInfo = userInfoRes.data?.data?.user;
    const tiktokUsername = userInfo?.username || userInfo?.display_name;

    // Figure out which creator to link this to
    let creatorId = statePayload.creatorId;

    // If no creator pre-selected, try to match by handle
    if (!creatorId && tiktokUsername) {
      const match = await prisma.creator.findFirst({
        where: {
          teamId: statePayload.teamId,
          handle: { contains: tiktokUsername, mode: "insensitive" },
        },
      });
      if (match) creatorId = match.id;
    }

    if (!creatorId) {
      return NextResponse.redirect(
        `${origin}/profile?error=no_creator_match`
      );
    }

    // Store tokens on the creator record
    await prisma.creator.update({
      where: { id: creatorId },
      data: {
        tiktokUserId: open_id,
        tiktokUsername: tiktokUsername,
        tiktokAccessToken: access_token,
        tiktokRefreshToken: refresh_token,
        tiktokTokenExpires: new Date(Date.now() + expires_in * 1000),
        tiktokConnectedAt: new Date(),
        avatarUrl: userInfo?.avatar_url || undefined,
      },
    });

    return NextResponse.redirect(`${origin}/profile?connected=tiktok`);
  } catch (error) {
    console.error("TikTok OAuth callback error:", error);
    return NextResponse.redirect(
      `${origin}/profile?error=oauth_failed`
    );
  }
}
