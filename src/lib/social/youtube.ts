import axios from "axios";
import type { SocialPost, SocialApiClient } from "./types";

/**
 * YouTube Data API v3 client.
 *
 * Searches for videos by a channel/username, then fetches video statistics.
 *
 * Required env vars:
 *   YOUTUBE_API_KEY
 */
export class YouTubeClient implements SocialApiClient {
  private apiKey: string;
  private baseUrl = "https://www.googleapis.com/youtube/v3";

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || "";
  }

  async fetchUserPosts(username: string, since?: Date): Promise<SocialPost[]> {
    if (!this.apiKey) {
      console.warn("YouTube API key not configured, skipping");
      return [];
    }

    try {
      // Step 1: Find the channel ID by username/handle
      const channelRes = await axios.get(`${this.baseUrl}/search`, {
        params: {
          part: "snippet",
          q: username,
          type: "channel",
          maxResults: 1,
          key: this.apiKey,
        },
      });

      const channelId = channelRes.data?.items?.[0]?.snippet?.channelId;
      if (!channelId) return [];

      // Step 2: Search for recent videos on the channel
      const searchParams: Record<string, string> = {
        part: "snippet",
        channelId,
        type: "video",
        order: "date",
        maxResults: "50",
        key: this.apiKey,
      };

      if (since) {
        searchParams.publishedAfter = since.toISOString();
      }

      const searchRes = await axios.get(`${this.baseUrl}/search`, {
        params: searchParams,
      });

      const videoItems = searchRes.data?.items || [];
      if (videoItems.length === 0) return [];

      // Step 3: Get statistics for each video
      const videoIds = videoItems
        .map((v: Record<string, unknown>) => (v.id as Record<string, string>)?.videoId)
        .filter(Boolean)
        .join(",");

      const statsRes = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          part: "statistics,snippet",
          id: videoIds,
          key: this.apiKey,
        },
      });

      const videos = statsRes.data?.items || [];

      return videos.map(
        (v: Record<string, unknown>): SocialPost => {
          const snippet = v.snippet as Record<string, unknown>;
          const stats = v.statistics as Record<string, string>;
          const thumbnails = snippet.thumbnails as Record<string, Record<string, unknown>>;

          return {
            externalId: String(v.id),
            platform: "YOUTUBE",
            username,
            title: (snippet.title as string) || null,
            link: `https://www.youtube.com/watch?v=${v.id}`,
            thumbnailUrl: (thumbnails?.high?.url as string) || (thumbnails?.default?.url as string) || null,
            postedAt: new Date(snippet.publishedAt as string),
            views: parseInt(stats?.viewCount || "0"),
            likes: parseInt(stats?.likeCount || "0"),
            shares: 0, // YouTube doesn't expose share count
            saves: 0,
            comments: parseInt(stats?.commentCount || "0"),
          };
        }
      );
    } catch (error) {
      console.error(`YouTube API error for ${username}:`, error);
      return [];
    }
  }
}
