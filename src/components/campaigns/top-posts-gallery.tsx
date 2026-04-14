import Image from "next/image";
import { ExternalLink } from "lucide-react";

interface TopPost {
  id: string;
  title: string | null;
  link: string;
  thumbnailUrl: string | null;
  views: number;
  referrals: number;
  creator: { handle: string };
}

export function TopPostsGallery({ posts }: { posts: TopPost[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Top Posts</h3>
        <span className="text-xs text-slate-400">
          Ranked by views
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-slate-100">
              {post.thumbnailUrl ? (
                <Image
                  src={post.thumbnailUrl}
                  alt={post.title || "Post thumbnail"}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No thumbnail
                </div>
              )}
              {/* Gradient + overlay info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                <p className="text-xs font-semibold">
                  {post.views.toLocaleString()} views
                </p>
                <p className="truncate text-[11px] text-white/80">
                  @{post.creator.handle}
                </p>
              </div>
              <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3 w-3 text-slate-700" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
