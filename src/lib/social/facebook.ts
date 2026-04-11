import axios from "axios";
import type { SocialPost, SocialApiClient } from "./types";

/**
 * Facebook Graph API client.
 *
 * Fetches posts from a Facebook Page.
 * Requires a Page access token with pages_read_engagement permission.
 *
 * Required env vars:
 *   FACEBOOK_APP_ID
 *   FACEBOOK_APP_SECRET
 */
export class FacebookClient implements SocialApiClient {
  private appId: string;
  private appSecret: string;
  private baseUrl = "https://graph.facebook.com/v18.0";

  constructor() {
    this.appId = process.env.FACEBOOK_APP_ID || "";
    this.appSecret = process.env.FACEBOOK_APP_SECRET || "";
  }

  private async getAppToken(): Promise<string> {
    const res = await axios.get(`${this.baseUrl}/oauth/access_token`, {
      params: {
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: "client_credentials",
      },
    });
    return res.data.access_token;
  }

  async fetchUserPosts(username: string, since?: Date): Promise<SocialPost[]> {
    if (!this.appId || !this.appSecret) {
      console.warn("Facebook API credentials not configured, skipping");
      return [];
    }

    try {
      const token = await this.getAppToken();

      const params: Record<string, string> = {
        fields: "id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true),comments.summary(true)",
        access_token: token,
        limit: "100",
      };

      if (since) {
        params.since = Math.floor(since.getTime() / 1000).toString();
      }

      const res = await axios.get(
        `${this.baseUrl}/${username}/posts`,
        { params }
      );

      const posts = res.data?.data || [];

      return posts.map(
        (p: Record<string, unknown>): SocialPost => {
          const shares = p.shares as Record<string, number> | undefined;
          const reactions = p.reactions as Record<string, unknown> | undefined;
          const reactionsSummary = reactions?.summary as Record<string, number> | undefined;
          const commentsData = p.comments as Record<string, unknown> | undefined;
          const commentsSummary = commentsData?.summary as Record<string, number> | undefined;

          return {
            externalId: String(p.id),
            platform: "FACEBOOK",
            username,
            title: ((p.message as string) || "").substring(0, 200) || null,
            link: (p.permalink_url as string) || `https://www.facebook.com/${p.id}`,
            thumbnailUrl: (p.full_picture as string) || null,
            postedAt: new Date(p.created_time as string),
            views: 0, // Facebook doesn't expose view counts on posts
            likes: reactionsSummary?.total_count || 0,
            shares: shares?.count || 0,
            saves: 0,
            comments: commentsSummary?.total_count || 0,
          };
        }
      );
    } catch (error) {
      console.error(`Facebook API error for ${username}:`, error);
      return [];
    }
  }
}
