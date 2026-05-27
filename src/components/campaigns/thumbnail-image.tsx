"use client";

import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

/**
 * Renders a post thumbnail with graceful failure. Two reasons IG/TikTok
 * thumbnails commonly fail:
 *   1. The signed URL expired (IG: ~24h, TikTok: longer). Re-sync or own
 *      the image on R2/Vercel Blob to fix permanently.
 *   2. Instagram CDN returns 403 when the Referer header points at our
 *      origin. `referrerPolicy="no-referrer"` makes the browser drop it.
 * When either still fails, we swap to a clean placeholder rather than
 * showing the alt text on a transparent background.
 */
// Hostnames the server-side proxy will accept. Anything else (including
// already-cached/own-domain URLs from a future R2 / Vercel Blob switchover)
// renders directly. Keeps this file as the single decision point for "do we
// need the proxy?" without each call site having to know.
const PROXIED_HOSTS = [
  /\.cdninstagram\.com$/,
  /\.fbcdn\.net$/,
  /\.tiktokcdn\.com$/,
  /\.tiktokcdn-us\.com$/,
];

function proxiedSrc(raw: string): string {
  try {
    const u = new URL(raw);
    if (PROXIED_HOSTS.some((re) => re.test(u.hostname))) {
      return `/api/img?url=${encodeURIComponent(raw)}`;
    }
  } catch {
    // Fall through — let the browser try the raw value.
  }
  return raw;
}

export function ThumbnailImage({
  src,
  alt,
  className = "h-full w-full object-cover transition-transform group-hover:scale-105",
  fallbackText = "Thumbnail unavailable",
}: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        {fallbackText}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={proxiedSrc(src)}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
}
