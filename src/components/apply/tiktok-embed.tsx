"use client";

/**
 * Embed a TikTok video using their official iframe embed.
 * Accepts either a full URL or just the video ID.
 */
export function TikTokEmbed({
  url,
  caption,
}: {
  url: string;
  caption?: string;
}) {
  // Extract video ID from URL: https://www.tiktok.com/@user/video/1234567890
  const match = url.match(/\/video\/(\d+)/);
  const videoId = match?.[1] || url;

  return (
    <div className="flex flex-col">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
        style={{ aspectRatio: "9 / 16" }}
      >
        <iframe
          src={`https://www.tiktok.com/embed/v2/${videoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin"
        />
      </div>
      {caption && (
        <p className="mt-3 text-center text-xs text-slate-500">{caption}</p>
      )}
    </div>
  );
}
