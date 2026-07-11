export interface DashboardParams {
  campaign?: string;
  range?: string;
  from?: string;
  to?: string;
  week?: number;
  platform?: string;
  top?: number;
}

/**
 * Serialize dashboard state into a URL, omitting defaults so the bare
 * /dashboard URL stays canonical. Every dashboard link (range pills, platform
 * tabs, week arrows, campaign switcher) routes through this so filters
 * survive each other.
 */
export function dashboardUrl(p: DashboardParams, basePath = "/dashboard") {
  const q = new URLSearchParams();
  if (p.campaign) q.set("campaign", p.campaign);
  if (p.range && p.range !== "7d") q.set("range", p.range);
  if (p.range === "custom") {
    if (p.from) q.set("from", p.from);
    if (p.to) q.set("to", p.to);
  }
  if (p.week && p.week > 0) q.set("week", String(p.week));
  if (p.platform && p.platform !== "ALL") q.set("platform", p.platform);
  if (p.top && p.top !== 5) q.set("top", String(p.top));
  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
