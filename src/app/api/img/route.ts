import { NextResponse } from "next/server";

/**
 * Server-side image proxy for TikTok / Instagram thumbnails.
 *
 * Why: IG CDN signed URLs (cdninstagram.com / fbcdn.net) often fail when
 * loaded directly by the browser — short-TTL signatures, cookie checks,
 * or User-Agent gating. Fetching server-side with a browser-like UA gets
 * us past most of these. URLs whose signature has truly expired will still
 * fail (404/410) — those need durable thumbnail caching (R2 / Vercel Blob),
 * which is a separate change.
 *
 * Locked to a hostname allowlist so this can't be turned into an open SSRF.
 */

const ALLOWED_HOST = [
  /\.cdninstagram\.com$/,
  /\.fbcdn\.net$/,
  /\.tiktokcdn\.com$/,
  /\.tiktokcdn-us\.com$/,
];

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) {
    return new NextResponse("missing url", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return new NextResponse("https only", { status: 400 });
  }
  if (!ALLOWED_HOST.some((re) => re.test(parsed.hostname))) {
    return new NextResponse("host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      // Don't forward cookies, don't follow auth redirects.
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        // Cache on Vercel's edge for an hour. Signed URLs change per sync so
        // this is safe — a new sync produces a new ?url=… and a new cache key.
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
