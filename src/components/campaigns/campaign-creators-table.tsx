import Link from "next/link";
import { TierBadge } from "@/components/creators/tier-badge";
import { Flame } from "lucide-react";
import { ATTRIBUTION_ENABLED } from "@/lib/constants";

export interface CampaignCreatorRow {
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  tier: string;
  /** Still active on THIS campaign (false = cut). */
  onCampaign: boolean;
  /** Active on the roster at all (false = deactivated agency-wide). */
  creatorActive: boolean;
  creatorShadowbanned: boolean;
  /** Number of this creator's handles currently flagged shadow-banned. */
  shadowbannedHandles: number;
  countAllPlatforms: boolean;
  videosPerDay: number;
  postCount: number;
  totalViews: number;
  avgViews: number;
  totalLikes: number;
  viralCount: number;
  totalReferrals: number;
}

export function CampaignCreatorsTable({
  creators,
}: {
  creators: CampaignCreatorRow[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Creators ({creators.length})
        </h3>
        <span className="text-xs text-slate-400">
          {ATTRIBUTION_ENABLED ? "Ranked by total referrals" : "Ranked by total views"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-5 py-3 text-xs font-medium text-gray-500">
                Creator
              </th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">
                Status
              </th>
              <th className="px-5 py-3 text-xs font-medium text-gray-500">
                Tier
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                Videos/day
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                Posts
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                Total views
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                Avg views
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  Viral
                </span>
              </th>
              {ATTRIBUTION_ENABLED && (
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Referrals
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {creators.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-6 text-center text-sm text-slate-400"
                >
                  No creators assigned yet
                </td>
              </tr>
            ) : (
              creators.map((c) => (
                <tr
                  key={c.creatorId}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/creators/${c.creatorId}`}
                      className="flex items-center gap-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                        {c.creatorName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          @{c.creatorHandle}
                        </p>
                        <p className="text-xs text-slate-400">
                          {c.creatorName}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {!c.creatorActive ? (
                        <span
                          title="Deactivated from the whole roster — syncing STOPPED, history kept"
                          className="cursor-help rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                        >
                          Deactivated
                        </span>
                      ) : !c.onCampaign ? (
                        <span
                          title="Cut from this campaign — hidden from pacing/progress, but posts STILL SYNC so viral videos are caught"
                          className="cursor-help rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
                        >
                          Cut
                        </span>
                      ) : (
                        <span
                          title="Active on this campaign"
                          className="cursor-help rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-600"
                        >
                          Active
                        </span>
                      )}
                      {c.creatorShadowbanned && (
                        <span
                          title="Whole creator marked shadow-banned — excluded from pacing"
                          className="cursor-help rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600"
                        >
                          SB
                        </span>
                      )}
                      {c.shadowbannedHandles > 0 && (
                        <span
                          title={`${c.shadowbannedHandles} of their handles flagged shadow-banned — pacing continues on their other handles`}
                          className="cursor-help rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600"
                        >
                          {c.shadowbannedHandles} SB handle
                          {c.shadowbannedHandles === 1 ? "" : "s"}
                        </span>
                      )}
                      {c.countAllPlatforms && (
                        <span
                          title="Every post on every platform/handle counts toward their goal (unique content per account)"
                          className="cursor-help rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600"
                        >
                          All platforms
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-600">
                    {c.videosPerDay}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-700">
                    {c.postCount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-slate-700">
                    {c.totalViews.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-slate-500">
                    {c.avgViews.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-orange-600">
                    {c.viralCount}
                  </td>
                  {ATTRIBUTION_ENABLED && (
                    <td className="px-5 py-3 text-right text-sm font-semibold text-emerald-600">
                      {c.totalReferrals.toLocaleString()}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
