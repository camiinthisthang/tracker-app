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
 * - streamers/youtube-scraper (~$0.50 / 1K results) — pointed at the channel's
 *   /shorts tab so we only pull Shorts
 *
 * Required env var: APIFY_TOKEN (create from apify.com account settings).
 */

const APIFY_BASE = "https://api.apify.com/v2";

/** Per-handle scrape cap. Sync's deletion-reconciliation uses this to tell
 * "we saw the whole account" from "the scrape hit the cap". */
export const SCRAPE_RESULTS_LIMIT = 60;

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
  try {
    const res = await axios.post(url, input, {
      params: { token: getToken() },
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    throw new Error(describeApifyError(err), { cause: err });
  }
}

/**
 * Turn an axios/Apify failure into a human-readable reason that can be shown
 * in the UI. The important case is credit exhaustion ("Monthly usage hard
 * limit exceeded", HTTP 402/403) — before this, it surfaced as a generic
 * "fetch failed" and the dashboard just showed stale or zero views.
 */
export function describeApifyError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") return "Apify run timed out";
    const status = err.response?.status;
    const data = err.response?.data as
      | { error?: { type?: string; message?: string } }
      | undefined;
    const message = data?.error?.message ?? err.message;
    const quotaHit =
      status === 402 ||
      /limit|quota|credit|payment/i.test(message);
    return `Apify error${status ? ` ${status}` : ""}: ${message}${
      quotaHit ? " — likely out of Apify credits" : ""
    }`;
  }
  return err instanceof Error ? err.message : String(err);
}

function stripHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^@+/, "");
  return cleaned.length > 0 ? cleaned : null;
}

/** Every field name the Instagram actors are known to report plays/views
 * under, across versions of apify/instagram-scraper and
 * apify/instagram-reel-scraper. */
const IG_VIEW_KEYS = [
  "videoViewCount",
  "videoPlayCount",
  "igPlayCount",
  "playCount",
  "playsCount",
  "viewsCount",
  "videoViews",
  "reelPlayCount",
] as const;

function igViews(p: Record<string, unknown>): number {
  return Math.max(0, ...IG_VIEW_KEYS.map((k) => toInt(p[k])));
}

/**
 * Fetch a creator's recent TikTok videos via the clockworks/tiktok-scraper
 * actor. Returns normalized SocialPost objects ready to upsert.
 */
export async function fetchTikTokPostsViaApify(
  handle: string,
  limit = SCRAPE_RESULTS_LIMIT
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
    const musicMeta = (v.musicMeta as Record<string, unknown> | undefined) ?? {};

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
      musicTitle: typeof musicMeta.musicName === "string" ? musicMeta.musicName : null,
      musicAuthor:
        typeof musicMeta.musicAuthor === "string" ? musicMeta.musicAuthor : null,
      musicOriginal:
        typeof musicMeta.musicOriginal === "boolean" ? musicMeta.musicOriginal : null,
      isPinned: v.isPinned === true,
    });
  }
  return posts;
}

/**
 * Fetch a creator's recent Instagram content via TWO scrapes merged:
 * - apify/instagram-scraper on the profile → the main feed grid
 * - apify/instagram-reel-scraper → the Reels tab
 *
 * The Reels tab is scraped separately because a reel that wasn't shared to
 * the feed exists ONLY there — the feed scrape never sees it (the Aspen
 * "30.1K reel missing" case). Duplicates are merged by id, keeping the
 * highest view count (the two actors can disagree, and stale-low counts are
 * a known actor bug). One scrape failing is tolerated as long as the other
 * succeeds; both failing throws so the sync summary shows the real error.
 */
export async function fetchInstagramPostsViaApify(
  handle: string,
  limit = SCRAPE_RESULTS_LIMIT
): Promise<SocialPost[]> {
  const clean = stripHandle(handle);
  if (!clean) return [];

  const [feed, reels] = await Promise.allSettled([
    runActorSync("apify~instagram-scraper", {
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: "posts",
      resultsLimit: limit,
      addParentData: false,
    }),
    runActorSync("apify~instagram-reel-scraper", {
      username: [clean],
      resultsLimit: limit,
    }),
  ]);

  if (feed.status === "rejected" && reels.status === "rejected") {
    throw feed.reason;
  }
  for (const [label, r] of [
    ["feed", feed],
    ["reels", reels],
  ] as const) {
    if (r.status === "rejected") {
      console.warn(
        `[ig-sync] @${clean} ${label} scrape failed (continuing with the other): ${
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        }`
      );
    }
  }

  const merged = new Map<string, SocialPost>();
  for (const post of [
    ...mapInstagramItems(feed.status === "fulfilled" ? feed.value : [], clean),
    ...mapInstagramItems(
      reels.status === "fulfilled" ? reels.value : [],
      clean
    ),
  ]) {
    const prev = merged.get(post.externalId);
    if (!prev) {
      merged.set(post.externalId, post);
      continue;
    }
    merged.set(post.externalId, {
      ...prev,
      views: Math.max(prev.views, post.views),
      likes: Math.max(prev.likes, post.likes),
      comments: Math.max(prev.comments, post.comments),
      title: prev.title ?? post.title,
      thumbnailUrl: prev.thumbnailUrl ?? post.thumbnailUrl,
      isPinned: prev.isPinned || post.isPinned,
    });
  }
  return [...merged.values()];
}

function mapInstagramItems(items: unknown[], clean: string): SocialPost[] {
  const posts: SocialPost[] = [];
  for (const raw of items) {
    const p = raw as Record<string, unknown>;
    const id = String(p.id ?? p.shortCode ?? "");
    if (!id) continue;

    // Reels expose a play/view count under several keys depending on the
    // actor and version, and the actors often return a stale-or-partial
    // videoViewCount ALONGSIDE the real play count — `??` never falls
    // through on a present-but-low number (Annie's 672 vs the real 5,308;
    // Aspen's 2.8K vs the real 30.1K). Take the highest candidate across
    // every alias either actor is known to use. Feed photos expose none → 0.
    const views = igViews(p);
    console.log(
      `[ig-sync] @${clean} ${id} type=${p.type ?? p.productType ?? "?"} ` +
        IG_VIEW_KEYS.map((k) => `${k}=${String(p[k])}`).join(" ") +
        ` likesCount=${String(p.likesCount)} -> views=${views}`
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
      isPinned: p.isPinned === true,
    });
  }
  return posts;
}

/**
 * Fetch a creator's recent YouTube Shorts via streamers/youtube-scraper,
 * pointed at the channel's /shorts tab so regular videos and streams never
 * enter the dataset. Field names vary a little between actor versions, so the
 * mapper tries the known aliases for each metric.
 */
export async function fetchYouTubeShortsViaApify(
  handle: string,
  limit = SCRAPE_RESULTS_LIMIT
): Promise<SocialPost[]> {
  const clean = stripHandle(handle);
  if (!clean) return [];

  // YouTube runs slower than the TikTok/IG actors — give it more headroom
  // than the default 120s before the client gives up.
  const items = await runActorSync(
    "streamers~youtube-scraper",
    {
      startUrls: [{ url: `https://www.youtube.com/@${clean}/shorts` }],
      maxResults: limit,
      maxResultsShorts: limit,
      maxResultStreams: 0,
    },
    240_000
  );

  const posts: SocialPost[] = [];
  for (const raw of items) {
    const v = raw as Record<string, unknown>;
    const url = typeof v.url === "string" ? v.url : "";
    const id = String(
      v.id ?? v.videoId ?? url.match(/(?:shorts\/|v=)([\w-]{6,})/)?.[1] ?? ""
    );
    if (!id) continue;
    if (v.isLive === true || v.type === "stream") continue;

    const views = toInt(v.viewCount ?? v.views);
    console.log(
      `[yt-sync] @${clean} ${id} viewCount=${String(v.viewCount ?? v.views)} ` +
        `likes=${String(v.likes ?? v.likeCount)} -> views=${views}`
    );

    posts.push({
      externalId: id,
      platform: "YOUTUBE",
      username: clean,
      title:
        (typeof v.title === "string" && v.title) ||
        (typeof v.text === "string" && v.text) ||
        null,
      link: url || `https://www.youtube.com/shorts/${id}`,
      thumbnailUrl:
        (typeof v.thumbnailUrl === "string" && v.thumbnailUrl) ||
        (typeof v.thumbnail === "string" && v.thumbnail) ||
        null,
      postedAt: parseDate(v.date ?? v.publishedAt ?? v.uploadDate),
      views,
      likes: toInt(v.likes ?? v.likeCount),
      shares: 0,
      saves: 0,
      comments: toInt(v.commentsCount ?? v.commentCount),
    });
  }
  return posts;
}

/**
 * Read-only diagnostic: run BOTH Instagram actors for one handle and return
 * the raw view-related fields per item, plus any actor error verbatim.
 * Powers /api/creators/[id]/scrape-debug so "what is Apify actually
 * returning?" is answerable from the browser instead of server logs.
 */
export async function debugScrapeInstagram(handle: string, limit = 10) {
  const clean = stripHandle(handle);
  if (!clean) return { handle, error: "empty handle" };

  const describeItems = (items: unknown[]) =>
    items.map((raw) => {
      const p = raw as Record<string, unknown>;
      return {
        id: String(p.id ?? ""),
        shortCode: String(p.shortCode ?? ""),
        type: String(p.type ?? p.productType ?? "?"),
        timestamp: String(p.timestamp ?? p.takenAtTimestamp ?? ""),
        caption:
          typeof p.caption === "string" ? p.caption.slice(0, 60) : null,
        likesCount: toInt(p.likesCount),
        computedViews: igViews(p),
        rawViewFields: Object.fromEntries(
          IG_VIEW_KEYS.filter((k) => p[k] !== undefined).map((k) => [
            k,
            p[k],
          ])
        ),
      };
    });

  const run = async (label: string, actor: string, input: Record<string, unknown>) => {
    try {
      const items = await runActorSync(actor, input);
      return { label, actor, ok: true, count: items.length, items: describeItems(items) };
    } catch (e) {
      return {
        label,
        actor,
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  };

  const [feed, reels] = await Promise.all([
    run("feed", "apify~instagram-scraper", {
      directUrls: [`https://www.instagram.com/${clean}/`],
      resultsType: "posts",
      resultsLimit: limit,
      addParentData: false,
    }),
    run("reels", "apify~instagram-reel-scraper", {
      username: [clean],
      resultsLimit: limit,
    }),
  ]);
  return { handle: clean, feed, reels };
}

// YouTube sometimes reports relative dates ("2 weeks ago") instead of ISO
// timestamps. Resolve those before falling back to Date parsing — a wrong
// "now" here would break campaign-window filtering.
function parseDate(v: unknown): Date {
  if (typeof v === "string") {
    const rel = v.match(
      /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i
    );
    if (rel) {
      const unitMs: Record<string, number> = {
        second: 1_000,
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000,
        month: 2_629_800_000,
        year: 31_557_600_000,
      };
      return new Date(
        Date.now() - Number(rel[1]) * unitMs[rel[2].toLowerCase()]
      );
    }
  }
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }
  return 0;
}
