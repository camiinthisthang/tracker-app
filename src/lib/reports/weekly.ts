import { subDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export interface WeeklyDigest {
  /** null when computing an agency-wide digest (no single team). */
  teamId: string | null;
  weekStart: Date;
  weekEnd: Date;
  totalViews: number;
  totalPosts: number;
  topHooks: Array<{
    hook: string;
    postCount: number;
    totalViews: number;
  }>;
  topCreators: Array<{
    creatorId: string;
    name: string;
    handle: string;
    views: number;
    referrals: number;
  }>;
  attributedSignups: number | null;
}

/**
 * Compute a week-over-week digest. Pass a `teamId` to scope to one team
 * (the per-team weekly cron does this) or `null` to aggregate across every
 * team (the admin /reports page does this for agency users so they see one
 * combined view instead of just their home agency team's digest, which is
 * almost always empty). `weekEnd` defaults to now; `weekStart` is 7 days
 * earlier. `attributedSignups` is null until the PostHog sync is configured.
 */
export async function computeWeeklyDigest(
  teamId: string | null,
  weekEnd: Date = new Date()
): Promise<WeeklyDigest> {
  const weekStart = startOfDay(subDays(weekEnd, 7));
  // `undefined` (not `{}`) when aggregating agency-wide so the relation/team
  // filter is omitted entirely rather than relying on empty-object semantics.
  const creatorFilter = teamId ? { teamId } : undefined;

  const [posts, creators] = await Promise.all([
    prisma.post.findMany({
      where: {
        ...(creatorFilter && { creator: creatorFilter }),
        postedAt: { gte: weekStart, lte: weekEnd },
      },
      select: {
        hook: true,
        views: true,
        referrals: true,
        creatorId: true,
        creator: { select: { name: true, handle: true } },
      },
    }),
    prisma.creator.findMany({
      where: creatorFilter,
      select: { id: true, name: true, handle: true },
    }),
  ]);

  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const totalPosts = posts.length;

  const hookAgg = new Map<
    string,
    { postCount: number; totalViews: number }
  >();
  for (const p of posts) {
    if (!p.hook) continue;
    const cur = hookAgg.get(p.hook) ?? { postCount: 0, totalViews: 0 };
    cur.postCount += 1;
    cur.totalViews += p.views;
    hookAgg.set(p.hook, cur);
  }
  const topHooks = Array.from(hookAgg.entries())
    .map(([hook, d]) => ({ hook, ...d }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 5);

  const creatorAgg = new Map<
    string,
    { views: number; referrals: number }
  >();
  for (const p of posts) {
    const cur = creatorAgg.get(p.creatorId) ?? { views: 0, referrals: 0 };
    cur.views += p.views;
    cur.referrals += p.referrals;
    creatorAgg.set(p.creatorId, cur);
  }
  const creatorIndex = new Map(creators.map((c) => [c.id, c]));
  const topCreators = Array.from(creatorAgg.entries())
    .map(([creatorId, d]) => {
      const c = creatorIndex.get(creatorId);
      return {
        creatorId,
        name: c?.name ?? "—",
        handle: c?.handle ?? "—",
        views: d.views,
        referrals: d.referrals,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return {
    teamId,
    weekStart,
    weekEnd,
    totalViews,
    totalPosts,
    topHooks,
    topCreators,
    // Populated by the PostHog sync job once wired up — null means "not yet
    // configured".
    attributedSignups: null,
  };
}

export function renderWeeklyDigestHtml(
  teamName: string,
  digest: WeeklyDigest
): string {
  const fmt = (n: number) => n.toLocaleString();
  const hooksRows = digest.topHooks
    .map(
      (h) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">${escape(h.hook)}</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right">${h.postCount}</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right">${fmt(h.totalViews)}</td></tr>`
    )
    .join("");
  const creatorsRows = digest.topCreators
    .map(
      (c) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">@${escape(c.handle)}</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right">${fmt(c.views)}</td><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right">${fmt(c.referrals)}</td></tr>`
    )
    .join("");

  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
  <h1 style="font-size:20px;margin:0 0 8px">${escape(teamName)} · weekly digest</h1>
  <p style="color:#64748b;margin:0 0 20px">${digest.weekStart.toISOString().slice(0,10)} → ${digest.weekEnd.toISOString().slice(0,10)}</p>

  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
    <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase">Total views this week</p>
    <p style="margin:4px 0 0;font-size:28px;font-weight:700">${fmt(digest.totalViews)}</p>
    <p style="margin:4px 0 0;color:#64748b;font-size:13px">${digest.totalPosts} posts</p>
  </div>

  <h2 style="font-size:14px;margin:20px 0 8px">Top hooks</h2>
  <table style="width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;border-collapse:collapse;overflow:hidden">
    <thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:8px 10px;font-size:12px">Hook</th><th style="text-align:right;padding:8px 10px;font-size:12px">Posts</th><th style="text-align:right;padding:8px 10px;font-size:12px">Views</th></tr></thead>
    <tbody>${hooksRows || '<tr><td style="padding:10px" colspan="3">No hooks tagged this week</td></tr>'}</tbody>
  </table>

  <h2 style="font-size:14px;margin:20px 0 8px">Top creators</h2>
  <table style="width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;border-collapse:collapse;overflow:hidden">
    <thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:8px 10px;font-size:12px">Creator</th><th style="text-align:right;padding:8px 10px;font-size:12px">Views</th><th style="text-align:right;padding:8px 10px;font-size:12px">Referrals</th></tr></thead>
    <tbody>${creatorsRows || '<tr><td style="padding:10px" colspan="3">No posts tracked this week</td></tr>'}</tbody>
  </table>

  <p style="color:#94a3b8;font-size:11px;margin-top:28px">Attributed signups: ${digest.attributedSignups ?? "not yet configured"}</p>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
