"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ACTIVE_PLATFORMS,
  PLATFORM_LABELS,
  platformProfileUrl,
} from "@/lib/constants";

interface Account {
  id: string;
  platform: string;
  handle: string;
  isActive: boolean;
  note: string | null;
  campaignName: string | null;
}

interface Props {
  creatorId: string;
  accounts: Account[];
  campaigns: { id: string; name: string }[];
}

export function CreatorExtraAccounts({ creatorId, accounts, campaigns }: Props) {
  const router = useRouter();
  const [platform, setPlatform] = useState<string>("TIKTOK");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!handle.trim()) {
      toast.error("Enter a handle");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          handle: handle.trim(),
          note: note.trim() || null,
          campaignId: campaignId === "all" ? null : campaignId,
        }),
      });
      if (!res.ok) {
        toast.error("Could not add account");
        return;
      }
      toast.success("Account added — it syncs from the next daily run");
      setHandle("");
      setNote("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(account: Account) {
    setTogglingId(account.id);
    try {
      const res = await fetch(
        `/api/creators/${creatorId}/accounts/${account.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !account.isActive }),
        }
      );
      if (!res.ok) {
        toast.error("Could not update account");
        return;
      }
      toast.success(
        account.isActive
          ? "Account deactivated — its posts still count, syncing stopped"
          : "Account reactivated"
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Extra accounts
        </h3>
        <p className="text-xs text-slate-500">
          Additional accounts beyond the main handles above — e.g. a new
          account after a shadow ban, or a second account posting for other
          campaigns. Posts from every account count toward this creator&apos;s
          totals. Scope an account to one campaign when the creator uses a
          different handle there. Deactivate an account to stop syncing it
          without losing its history.
        </p>
      </div>

      {accounts.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">
                  <a
                    href={platformProfileUrl(a.platform, a.handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-blue-600 hover:underline"
                  >
                    @{a.handle}
                    <ExternalLink className="h-3 w-3 text-blue-500" />
                  </a>
                  <span className="ml-2 text-xs text-slate-400">
                    {PLATFORM_LABELS[a.platform] ?? a.platform}
                  </span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {a.campaignName ?? "All campaigns"}
                  </span>
                </p>
                {a.note && (
                  <p className="truncate text-xs text-slate-400">{a.note}</p>
                )}
              </div>
              <Badge
                className={
                  a.isActive
                    ? "bg-green-50 text-green-600"
                    : "bg-slate-100 text-slate-500"
                }
              >
                {a.isActive ? "Syncing" : "Inactive"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={togglingId === a.id}
                onClick={() => handleToggle(a)}
              >
                {a.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36">
          <Select
            value={platform}
            onValueChange={(v) => v && setPlatform(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVE_PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="w-44"
          placeholder="handle (without @)"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <div className="w-44">
          <Select
            value={campaignId}
            onValueChange={(v) => v && setCampaignId(v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="min-w-40 flex-1"
          placeholder="note, e.g. replacement — main banned"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={saving}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {saving ? "Adding..." : "Add account"}
        </Button>
      </div>
    </div>
  );
}
