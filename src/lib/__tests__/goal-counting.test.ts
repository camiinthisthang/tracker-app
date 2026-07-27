import { describe, it, expect } from "vitest";
import {
  uniqueVideoCount,
  platformCounts,
} from "@/lib/social/goal-counting";
import type { Platform } from "@/generated/prisma/enums";

const posts = (...platforms: Platform[]) =>
  platforms.map((platform) => ({ platform }));

describe("uniqueVideoCount", () => {
  it("returns 0 for no posts", () => {
    expect(uniqueVideoCount([])).toBe(0);
  });

  it("equals plain count for single-platform posts", () => {
    expect(uniqueVideoCount(posts("TIKTOK", "TIKTOK", "TIKTOK"))).toBe(3);
  });

  it("counts a fully cross-posted video once", () => {
    expect(uniqueVideoCount(posts("TIKTOK", "INSTAGRAM", "YOUTUBE"))).toBe(1);
  });

  it("uses the max platform count when cross-posting is uneven", () => {
    // 7 IG posts, 5 cross-posted to TikTok, 3 to YouTube → 7 unique videos.
    expect(
      uniqueVideoCount([
        ...posts(
          "INSTAGRAM",
          "INSTAGRAM",
          "INSTAGRAM",
          "INSTAGRAM",
          "INSTAGRAM",
          "INSTAGRAM",
          "INSTAGRAM"
        ),
        ...posts("TIKTOK", "TIKTOK", "TIKTOK", "TIKTOK", "TIKTOK"),
        ...posts("YOUTUBE", "YOUTUBE", "YOUTUBE"),
      ])
    ).toBe(7);
  });
});

describe("platformCounts", () => {
  it("tallies posts per platform", () => {
    expect(
      platformCounts(posts("TIKTOK", "TIKTOK", "INSTAGRAM"))
    ).toEqual({ TIKTOK: 2, INSTAGRAM: 1 });
  });

  it("returns an empty object for no posts", () => {
    expect(platformCounts([])).toEqual({});
  });
});
