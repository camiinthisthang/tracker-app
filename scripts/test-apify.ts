/**
 * Apify smoke test. Run with: `npx tsx scripts/test-apify.ts`.
 * Uses resultsPerPage/resultsLimit=3 to keep credit burn near zero.
 */
import "dotenv/config";
import {
  fetchTikTokPostsViaApify,
  fetchInstagramPostsViaApify,
} from "../src/lib/social/apify";

function summarize(label: string, posts: unknown[]) {
  console.log(`\n=== ${label} ===`);
  console.log(`count=${posts.length}`);
  for (const p of posts as Array<Record<string, unknown>>) {
    const postedAt = p.postedAt as Date | undefined;
    console.log({
      externalId: p.externalId,
      title: typeof p.title === "string" ? (p.title as string).slice(0, 60) : p.title,
      link: p.link,
      views: p.views,
      likes: p.likes,
      comments: p.comments,
      thumbnailUrl:
        typeof p.thumbnailUrl === "string"
          ? (p.thumbnailUrl as string).slice(0, 80) + "…"
          : p.thumbnailUrl,
      postedAt: postedAt instanceof Date ? postedAt.toISOString() : postedAt,
    });
  }
}

async function main() {
  const handle = process.argv[2] ?? "nike";
  const limit = Number(process.argv[3] ?? 3);
  console.log(`Testing with handle="${handle}" limit=${limit}`);

  try {
    const tt = await fetchTikTokPostsViaApify(handle, limit);
    summarize("TikTok", tt);
  } catch (err) {
    console.error("TikTok fetch failed:", (err as Error).message);
  }

  try {
    const ig = await fetchInstagramPostsViaApify(handle, limit);
    summarize("Instagram", ig);
  } catch (err) {
    console.error("Instagram fetch failed:", (err as Error).message);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
