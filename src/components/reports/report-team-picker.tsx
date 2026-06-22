"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ReportTeamPicker({
  teams,
  selectedId,
}: {
  teams: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (teamId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("team", teamId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="border-b border-slate-200 bg-white print-hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <label
          htmlFor="report-team"
          className="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          Client
        </label>
        <select
          id="report-team"
          value={selectedId}
          onChange={(e) => select(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 focus:border-[color:var(--brand-blue)] focus:outline-none"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
