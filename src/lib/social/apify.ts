import axios from "axios";
import type { SocialPost } from "./types";

/**
 * Apify scraper client for TikTok + Instagram metrics.
 *
 * Why scrapers instead of official APIs:
 * - TikTok Display API requires each creator to OAuth into our app and only
 *   returns their own videos. Research API is academic-only and commercial
 *   CRM use gets rejected.
 * - Instagram Graph API requires creator Business conversion + FB Page link
 *   + OAuth + Meta app-review for insights. Way too much friction for a 10–15
 *   creator op.
 *
 * Apify runs public-endpoint scrapers from rotating proxies and gives us
 * structured JSON. Grey-area TOS-wise but industry standard at this scale.
 *
 * Actors used:
 * - clockworks/tiktok-scraper ($0.20 / 1K results)
 * - apify/instagram-scraper (~$1 / 1K results)
 *
 * Required env var: APIFY_TOKEN (create from apify.com account settings).
 */

const APIFY_BASE = "https://api.apify.com/v2";

function getToken() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set");
  return t;
}

/**
 * Run an actor synchronously and get the dataset items as a single response.
 * Apify waits up to 5 min; we cap client-side at 120s so one slow creator
 * doesn't eat a whole cron invocation.
 */
async function runActorSync(
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 120_000
): Promise<unknown[]> {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`;
  const res = await axios.post(url, input, {
    params: { token: getToken() },
    timeout: timeoutMs,
    headers: { "Content-Type": "application/json" },
  });
  return Array.isArray(res.data) ? res.data : [];
}

function stripHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^@+/, "");
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Fetch a creator's recent TikTok videos via the clockworks/tiktok-scraper
 * actor. Returns normalized SocialPost objects ready to upsert.
 */
export async function fetchTikTokPostsViaApify(
  handle: string,
  limit = 30
): Promise<SocialPost[]> {
  const clean = stripHandle(handle);
  if (!clean) return [];

  const items = await runActorSync("clockworks~tiktok-scraper", {
    profiles: [clean],
    resultsPerPage: limit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  });

  const posts: SocialPost[] = [];
  for (const raw of items) {
    const v = raw as Record<string, unknown>;
    const id = String(v.id ?? v.videoMeta ?? "");
    if (!id) continue;

    const createTime = typeof v.createTime === "number" ? v.createTime : null;
    const videoMeta = (v.videoMeta as Record<string, unknown> | undefined) ?? {};

    console.log(
      `[tt-sync] @${clean} ${id} playCount=${String(v.playCount)} ` +
        `diggCount=${String(v.diggCount)} ` +
        `commentCount=${String(v.commentCount)} -> views=${toInt(v.playCount)}`
    );

    posts.push({
      externalId: id,
      platform: "TIKTOK",
      username: clean,
      title:
        (v.text as string) ||
        (v.desc as string) ||
        (videoMeta.title as string) ||
        null,
      link:
        (v.webVideoUrl as string) ||
        `https://www.tiktok.com/@${clean}/video/${id}`,
      thumbnailUrl:
        (v.videoMeta as Record<string, unknown> | undefined)?.coverUrl as
          | string
          | null ??
        (v.covers as string[])?.[0] ??
        null,
      postedAt: createTime
        ? new Date(createTime * 1000)
        : v.createTimeISO
        ? new Date(v.createTimeISO as string)
        : new Date(),
      views: toInt(v.playCount),
      likes: toInt(v.diggCount),
      shares: toInt(v.shareCount),
      saves: toInt(v.collectCount),
      comments: toInt(v.commentCount),
    });
  }
  return posts;
}

/**
 * Fetch a creator's recent Instagram posts / reels via apify/instagram-scraper.
 */
export async function fetchInstagramPostsViaApify(
  handle: string,
  limit = 30
): Promise<SocialPost[]> {
  const clean = stripHandle(handle);
  if (!clean) return [];

  const items = await runActorSync("apify~instagram-scraper", {
    directUrls: [`https://www.instagram.com/${clean}/`],
    resultsType: "posts",
    resultsLimit: limit,
    addParentData: false,
  });

  const posts: SocialPost[] = [];
  for (const raw of items) {
    const p = raw as Record<string, unknown>;
    const id = String(p.id ?? p.shortCode ?? "");
    if (!id) continue;

    // Reels expose a play/view count under one of several keys depending on
    // the actor version (videoViewCount → videoPlayCount → igPlayCount). Feed
    // posts don't expose views at all, so we fall back to 0. We log the raw
    // candidates so we can diagnose under-reported counts (e.g. Claire's
    // #poncho Reels showing single-digit views) against what IG actually shows.
    const views = toInt(
      p.videoViewCount ?? p.videoPlayCount ?? p.igPlayCount
    );
    console.log(
      `[ig-sync] @${clean} ${id} type=${p.type ?? p.productType ?? "?"} ` +
        `videoViewCount=${String(p.videoViewCount)} ` +
        `videoPlayCount=${String(p.videoPlayCount)} ` +
        `igPlayCount=${String(p.igPlayCount)} ` +
        `likesCount=${String(p.likesCount)} -> views=${views}`
    );

    posts.push({
      externalId: id,
      platform: "INSTAGRAM",
      username: clean,
      title:
        typeof p.caption === "string"
          ? (p.caption as string).slice(0, 500)
          : null,
      link:
        (p.url as string) ||
        `https://www.instagram.com/p/${p.shortCode ?? id}/`,
      thumbnailUrl:
        (p.displayUrl as string) ||
        (p.thumbnailUrl as string) ||
        null,
      postedAt: p.timestamp
        ? new Date(p.timestamp as string)
        : p.takenAtTimestamp
        ? new Date((p.takenAtTimestamp as number) * 1000)
        : new Date(),
      views,
      likes: toInt(p.likesCount),
      shares: 0,
      saves: 0,
      comments: toInt(p.commentsCount),
    });
  }
  return posts;
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }
  return 0;
}
