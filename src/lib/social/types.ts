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
}

export interface SocialApiClient {
  fetchUserPosts(username: string, since?: Date): Promise<SocialPost[]>;
}
