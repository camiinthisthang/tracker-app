export interface SocialPost {
  externalId: string;
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "FACEBOOK";
  username: string;
  title: string | null;
  link: string;
  thumbnailUrl: string | null;
  postedAt: Date;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
  // TikTok-only: sound metadata from the scraper's musicMeta
  musicTitle?: string | null;
  musicAuthor?: string | null;
  musicOriginal?: boolean | null;
}

export interface SocialApiClient {
  fetchUserPosts(username: string, since?: Date): Promise<SocialPost[]>;
}
