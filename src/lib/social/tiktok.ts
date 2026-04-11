import axios from "axios";
import type { SocialPost, SocialApiClient } from "./types";

/**
 * TikTok API client using the Research API / Display API.
 *
 * TikTok's Research API requires an approved application.
 * This client uses the user info + video list endpoints.
 *
 * Required env vars:
 *   TIKTOK_CLIENT_KEY
 *   TIKTOK_CLIENT_SECRET
 */
export class TikTokClient implements SocialApiClient {
  private clientKey: string;
  private clientSecret: string;
  private accessToken: string | null = null;

  constructor() {
    this.clientKey = process.env.TIKTOK_CLIENT_KEY || "";
    this.clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const res = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: this.clientKey,
        client_secret: this.clientSecret,
        grant_type: "client_credentials",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    this.accessToken = res.data.access_token;
    return this.accessToken!;
  }

  async fetchUserPosts(username: string, since?: Date): Promise<SocialPost[]> {
    if (!this.clientKey || !this.clientSecret) {
      console.warn("TikTok API credentials not configured, skipping");
      return [];
    }

    try {
      const token = await this.getAccessToken();

      // TikTok Research API - query videos by username
      const query: Record<string, unknown> = {
        and: [{ field_name: "username", operation: "EQ", field_values: [username] }],
      };

      if (since) {
        query.and = [
          ...(query.and as unknown[]),
          {
            field_name: "create_date",
            operation: "GTE",
            field_values: [since.toISOString().split("T")[0]],
          },
        ];
      }

      const res = await axios.post(
        "https://open.tiktokapis.com/v2/research/video/query/",
        {
          query,
          max_count: 100,
          fields: "id,title,video_description,create_time,share_url,cover_image_url,view_count,like_count,share_count,comment_count",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const videos = res.data?.data?.videos || [];

      return videos.map(
        (v: Record<string, unknown>): SocialPost => ({
          externalId: String(v.id),
          platform: "TIKTOK",
          username,
          title: (v.video_description as string) || (v.title as string) || null,
          link: (v.share_url as string) || `https://www.tiktok.com/@${username}/video/${v.id}`,
          thumbnailUrl: (v.cover_image_url as string) || null,
          postedAt: new Date((v.create_time as number) * 1000),
          views: (v.view_count as number) || 0,
          likes: (v.like_count as number) || 0,
          shares: (v.share_count as number) || 0,
          saves: 0, // TikTok API doesn't expose saves
          comments: (v.comment_count as number) || 0,
        })
      );
    } catch (error) {
      console.error(`TikTok API error for @${username}:`, error);
      return [];
    }
  }
}
