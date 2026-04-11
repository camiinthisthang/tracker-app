import axios from "axios";
import type { SocialPost, SocialApiClient } from "./types";

/**
 * Instagram Graph API client.
 *
 * Uses the Instagram Graph API (via Facebook) to fetch media for a user.
 * Requires a long-lived user access token with instagram_basic + instagram_manage_insights permissions.
 *
 * Required env vars:
 *   INSTAGRAM_ACCESS_TOKEN
 */
export class InstagramClient implements SocialApiClient {
  private accessToken: string;
  private baseUrl = "https://graph.instagram.com/v18.0";

  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || "";
  }

  async fetchUserPosts(username: string, since?: Date): Promise<SocialPost[]> {
    if (!this.accessToken) {
      console.warn("Instagram API token not configured, skipping");
      return [];
    }

    try {
      // First, search for the user's Instagram Business Account ID
      // This assumes the token owner has access to the business account
      const searchRes = await axios.get(
        `https://graph.facebook.com/v18.0/ig_hashtag_search`,
        {
          params: {
            q: username,
            access_token: this.accessToken,
          },
        }
      );

      // For simplicity, use the user ID directly from the business account
      // In production, you'd look up the IG user ID from the FB page
      const userId = searchRes.data?.data?.[0]?.id;
      if (!userId) return [];

      // Fetch recent media
      const params: Record<string, string> = {
        fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count",
        access_token: this.accessToken,
        limit: "100",
      };

      if (since) {
        params.since = Math.floor(since.getTime() / 1000).toString();
      }

      const mediaRes = await axios.get(
        `${this.baseUrl}/${userId}/media`,
        { params }
      );

      const posts = mediaRes.data?.data || [];

      return posts.map(
        (p: Record<string, unknown>): SocialPost => ({
          externalId: String(p.id),
          platform: "INSTAGRAM",
          username,
          title: (p.caption as string)?.substring(0, 200) || null,
          link: (p.permalink as string) || `https://www.instagram.com/p/${p.id}/`,
          thumbnailUrl: (p.thumbnail_url as string) || (p.media_url as string) || null,
          postedAt: new Date(p.timestamp as string),
          views: 0, // Need insights API for reach/impressions
          likes: (p.like_count as number) || 0,
          shares: 0, // Not available via basic API
          saves: 0, // Requires insights API
          comments: (p.comments_count as number) || 0,
        })
      );
    } catch (error) {
      console.error(`Instagram API error for @${username}:`, error);
      return [];
    }
  }
}
