import Link from "next/link";
import {
  FLAG_LABELS,
  flagTooltip,
  type CreatorFlag,
  type PacingThresholds,
} from "@/lib/pacing";

const FLAG_STYLES: Record<CreatorFlag, string> = {
  off_pace: "bg-red-50 text-red-600",
  quiet: "bg-amber-50 text-amber-700",
  new: "bg-blue-50 text-blue-600",
  shadowbanned: "bg-violet-50 text-violet-600",
};

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export interface CreatorPacingCardData {
  id: string;
  name: string;
  handle: string;
  flags: CreatorFlag[];
  postsThisMonth: number;
  monthlyGoal: number;
  periodLabel: string;
  thresholds: PacingThresholds;
  views: number;
  likes: number;
  comments: number;
  campaignNames: string[];
}

export function CreatorPacingCard({ creator }: { creator: CreatorPacingCardData }) {
  const {
    flags,
    postsThisMonth,
    monthlyGoal,
    views,
    likes,
    comments,
    campaignNames,
  } = creator;
  const pct =
    monthlyGoal > 0 ? Math.min(100, (postsThisMonth / monthlyGoal) * 100) : 0;
  const shadowbanned = flags.includes("shadowbanned");
  const barColor = shadowbanned
    ? "bg-slate-300"
    : flags.includes("off_pace")
      ? "bg-red-500"
      : "bg-emerald-500";

  return (
    <Link
      href={`/creators/${creator.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {creator.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {creator.name}
            </p>
            <p className="truncate text-xs text-slate-400">@{creator.handle}</p>
          </div>
        </div>
        {flags.length > 0 && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {flags.map((f) => (
              <span
                key={f}
                title={flagTooltip(f, creator.thresholds)}
                className={`cursor-help rounded-full px-2 py-0.5 text-[10px] font-medium ${FLAG_STYLES[f]}`}
              >
                {FLAG_LABELS[f]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Goal progress — the hero of the card */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold text-slate-800">
            {postsThisMonth}
            <span
              className="text-sm font-medium text-slate-400"
              title="Goal = each campaign's per-creator monthly goal (or this creator's personal override), summed across their campaigns"
            >
              {" "}
              / {monthlyGoal || "—"} posts · {creator.periodLabel}
            </span>
          </p>
          {monthlyGoal > 0 && (
            <span className="text-xs font-medium text-slate-500">
              {Math.round(pct)}%
            </span>
          )}
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {shadowbanned && (
          <p className="mt-1 text-[10px] text-violet-500">
            Excluded from pacing while shadow-banned
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-5">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {compact(views)}
          </p>
          <p className="text-[10px] text-slate-400">views</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {compact(likes)}
          </p>
          <p className="text-[10px] text-slate-400">likes</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {compact(comments)}
          </p>
          <p className="text-[10px] text-slate-400">comments</p>
        </div>
      </div>

      {campaignNames.length > 0 && (
        <p className="mt-3 truncate text-xs text-slate-400">
          {campaignNames.join(" · ")}
        </p>
      )}
    </Link>
  );
}
