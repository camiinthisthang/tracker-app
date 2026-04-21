"use client";

import { useState, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { FilterPills } from "@/components/creators/creator-filter-pills";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GalleryPost {
  id: string;
  title: string | null;
  link: string;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  postedAt: string;
  creator: { id: string; handle: string };
}

interface PostsGalleryClientProps {
  posts: GalleryPost[];
  creators: { id: string; handle: string }[];
}

export function PostsGalleryClient({
  posts,
  creators,
}: PostsGalleryClientProps) {
  const [sortBy, setSortBy] = useState("newest");
  const [creatorFilter, setCreatorFilter] = useState("all");

  const creatorPills = useMemo(
    () => [
      { label: "All Creators", value: "all" },
      ...creators.map((c) => ({ label: c.handle, value: c.id })),
    ],
    [creators]
  );

  const filtered = useMemo(() => {
    let result = posts;
    if (creatorFilter !== "all") {
      result = result.filter((p) => p.creator.id === creatorFilter);
    }
    switch (sortBy) {
      case "newest":
        result = [...result].sort(
          (a, b) =>
            new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
        );
        break;
      case "views":
        result = [...result].sort((a, b) => b.views - a.views);
        break;
      case "likes":
        result = [...result].sort((a, b) => b.likes - a.likes);
        break;
      case "comments":
        result = [...result].sort((a, b) => b.comments - a.comments);
        break;
    }
    return result;
  }, [posts, sortBy, creatorFilter]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="views">Most Views</SelectItem>
            <SelectItem value="likes">Most Likes</SelectItem>
            <SelectItem value="comments">Most Comments</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          Showing {filtered.length} of {posts.length} posts
        </span>
      </div>

      {/* Creator pills */}
      <FilterPills
        options={creatorPills}
        value={creatorFilter}
        onChange={setCreatorFilter}
      />

      {/* Thumbnail Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm text-slate-400">No posts match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((post) => (
            <a
              key={post.id}
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[9/16] overflow-hidden rounded-lg bg-slate-100"
            >
              {post.thumbnailUrl ? (
                // Raw <img> — TikTok/IG signed thumbnail URLs break Next's
                // image proxy. See top-posts-gallery.tsx for the same fix.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.thumbnailUrl}
                  alt={post.title || "Post thumbnail"}
                  className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-xs text-slate-400">No thumbnail</span>
                </div>
              )}
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="line-clamp-2 text-xs text-white">
                  {post.title || "Untitled"}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/80">
                  <span>{post.views.toLocaleString()} views</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
