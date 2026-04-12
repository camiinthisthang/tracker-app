import axios from "axios";
import { prisma } from "@/lib/prisma";
import type { SocialPost } from "./types";

/**
 * TikTok Display API client.
 *
 * Uses per-creator OAuth access tokens (Login Kit) to fetch the creator's
 * own videos via the Display API.
 *
 * Requires scopes: user.info.basic, video.list
 */
export class TikTokClient {
  /**
   * Fetch posts for a single creator using their stored OAuth token.
   * Handles token refresh if expired.
   */
  async fetchCreatorPosts(creatorId: string): Promise<SocialPost[]> {
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
    });

    if (!creator || !creator.tiktokAccessToken) {
      console.warn(`Creator ${creatorId} has no TikTok access token`);
      return [];
    }

    // Refresh token if expired
    let accessToken = creator.tiktokAccessToken;
    if (
      creator.tiktokTokenExpires &&
      creator.tiktokTokenExpires < new Date()
    ) {
      const refreshed = await this.refreshToken(creator.tiktokRefreshToken!);
      if (refreshed) {
        accessToken = refreshed.access_token;
        await prisma.creator.update({
          where: { id: creatorId },
          data: {
            tiktokAccessToken: refreshed.access_token,
            tiktokRefreshToken: refreshed.refresh_token,
            tiktokTokenExpires: new Date(
              Date.now() + refreshed.expires_in * 1000
            ),
          },
        });
      } else {
        console.error(`Failed to refresh TikTok token for creator ${creatorId}`);
        return [];
      }
    }

    try {
      const res = await axios.post(
        "https://open.tiktokapis.com/v2/video/list/",
        { max_count: 20 },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          params: {
            fields:
              "id,title,video_description,create_time,share_url,cover_image_url,view_count,like_count,share_count,comment_count",
          },
        }
      );

      const videos = res.data?.data?.videos || [];

      return videos.map(
        (v: Record<string, unknown>): SocialPost => ({
          externalId: String(v.id),
          platform: "TIKTOK",
          username: creator.tiktokUsername || creator.handle,
          title:
            (v.video_description as string) ||
            (v.title as string) ||
            null,
          link:
            (v.share_url as string) ||
            `https://www.tiktok.com/@${creator.tiktokUsername}/video/${v.id}`,
          thumbnailUrl: (v.cover_image_url as string) || null,
          postedAt: new Date((v.create_time as number) * 1000),
          views: (v.view_count as number) || 0,
          likes: (v.like_count as number) || 0,
          shares: (v.share_count as number) || 0,
          saves: 0,
          comments: (v.comment_count as number) || 0,
        })
      );
    } catch (error) {
      console.error(`TikTok Display API error for creator ${creatorId}:`, error);
      return [];
    }
  }

  private async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null> {
    try {
      const res = await axios.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY!,
          client_secret: process.env.TIKTOK_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      return res.data;
    } catch (error) {
      console.error("TikTok token refresh error:", error);
      return null;
    }
  }

  /** Kept for backwards compatibility with sync orchestrator interface. */
  async fetchUserPosts(): Promise<SocialPost[]> {
    // This method is no longer used — we now fetch per-creator via fetchCreatorPosts
    return [];
  }
}
