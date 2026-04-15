import axios from "axios";
import { prisma } from "@/lib/prisma";

/**
 * Sync signup attribution data from PostHog for a single team.
 *
 * Expects PostHog events to carry `properties.referral_creator_id` matching a
 * Creator.id. Runs a HogQL query grouping signup events by (creator_id, day)
 * over the trailing window and upserts one `CreatorAttribution` row per pair.
 *
 * Returns { synced, totalRows, error }. Doesn't throw on individual team
 * failure — the cron collects successes across teams.
 */
export async function syncPostHogForTeam(
  teamId: string,
  windowDays = 30
): Promise<{ synced: boolean; totalRows: number; error?: string }> {
  const settings = await prisma.teamSettings.findUnique({
    where: { teamId },
  });
  if (!settings?.posthogApiKey || !settings?.posthogProjectId) {
    return { synced: false, totalRows: 0, error: "PostHog not configured" };
  }
  const host = (settings.posthogHost || "https://us.i.posthog.com").replace(
    /\/$/,
    ""
  );

  const creators = await prisma.creator.findMany({
    where: { teamId },
    select: { id: true },
  });
  const creatorIds = new Set(creators.map((c) => c.id));
  if (creatorIds.size === 0) {
    return { synced: true, totalRows: 0 };
  }

  // Default event name is 'signup'; individual clients can still send their
  // own event. The WHERE clause matches our referral_creator_id property
  // regardless of which event name was used.
  const query = `
SELECT properties.referral_creator_id AS creator_id,
       toDate(timestamp) AS day,
       count() AS cnt
FROM events
WHERE timestamp >= now() - interval ${Math.floor(windowDays)} day
  AND properties.referral_creator_id IS NOT NULL
  AND properties.referral_creator_id != ''
GROUP BY creator_id, day
ORDER BY day DESC`;

  let data;
  try {
    const res = await axios.post(
      `${host}/api/projects/${settings.posthogProjectId}/query`,
      { query: { kind: "HogQLQuery", query } },
      {
        headers: {
          Authorization: `Bearer ${settings.posthogApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30_000,
      }
    );
    data = res.data;
  } catch (err) {
    const msg =
      (err as { response?: { data?: { detail?: string } }; message?: string })
        .response?.data?.detail ||
      (err as Error).message ||
      "PostHog query failed";
    return { synced: false, totalRows: 0, error: msg };
  }

  const rows = (data as { results?: unknown[] })?.results ?? [];
  let totalRows = 0;
  for (const raw of rows) {
    if (!Array.isArray(raw) || raw.length < 3) continue;
    const [creatorIdRaw, dayRaw, cntRaw] = raw as [unknown, unknown, unknown];
    const creatorId = typeof creatorIdRaw === "string" ? creatorIdRaw : null;
    const day =
      typeof dayRaw === "string"
        ? new Date(dayRaw)
        : dayRaw instanceof Date
        ? dayRaw
        : null;
    const cnt = Number(cntRaw);
    if (!creatorId || !day || !Number.isFinite(cnt)) continue;
    if (!creatorIds.has(creatorId)) continue;

    await prisma.creatorAttribution.upsert({
      where: { creatorId_date: { creatorId, date: day } },
      create: { creatorId, date: day, signupCount: Math.floor(cnt) },
      update: { signupCount: Math.floor(cnt) },
    });
    totalRows += 1;
  }

  return { synced: true, totalRows };
}

/**
 * Lightweight "does this API key + project reach PostHog" check. Doesn't
 * validate the schema beyond a 200 response.
 */
export async function testPostHogConnection(
  apiKey: string,
  projectId: string,
  host?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const base = (host || "https://us.i.posthog.com").replace(/\/$/, "");
  try {
    await axios.get(`${base}/api/projects/${projectId}/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15_000,
    });
    return { ok: true };
  } catch (err) {
    const msg =
      (err as { response?: { status?: number }; message?: string }).response
        ?.status === 401
        ? "Auth failed — check API key"
        : (err as Error).message || "Unknown PostHog error";
    return { ok: false, error: msg };
  }
}
