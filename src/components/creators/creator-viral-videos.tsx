import { Flame, ExternalLink } from "lucide-react";
import { ThumbnailImage } from "@/components/campaigns/thumbnail-image";

interface ViralPost {
  id: string;
  title: string | null;
  link: string;
  thumbnailUrl: string | null;
  views: number;
  referrals: number;
}

export function CreatorViralVideos({ posts }: { posts: ViralPost[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-800">
            Your viral videos
          </h3>
        </div>
        <span className="text-xs text-slate-400">50K+ views</span>
      </div>

      {posts.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          No viral hits yet — keep posting, your next one is coming.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                  <ThumbnailImage
                    src={post.thumbnailUrl}
                    alt={post.title || "Thumbnail"}
                    className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    No thumbnail
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  <Flame className="h-2.5 w-2.5" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                  <p className="text-xs font-semibold">
                    {post.views.toLocaleString()} views
                  </p>
                  <p className="text-[11px] text-white/80">
                    {post.referrals.toLocaleString()} referrals
                  </p>
                </div>
                <div className="absolute left-2 top-2 rounded-full bg-white/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="h-3 w-3 text-slate-700" />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
