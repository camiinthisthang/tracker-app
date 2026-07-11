"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Music2, Camera, MonitorPlay, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { HandleLink } from "@/components/creators/handle-link";
import { ACTIVE_PLATFORMS, PLATFORM_LABELS, platformProfileUrl } from "@/lib/constants";
import { ExternalLink } from "lucide-react";

interface Account {
  id: string;
  platform: string;
  handle: string;
  isActive: boolean;
  note: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

interface CampaignRef {
  id: string;
  name: string;
  isActive: boolean;
  onCampaign: boolean; // false = creator was cut from this campaign
}

interface Props {
  creatorId: string;
  tiktokHandle: string | null;
  instagramHandle: string | null;
  youtubeHandle: string | null;
  fallbackHandle: string;
  accounts: Account[];
  campaigns: CampaignRef[];
}

/**
 * One card for everything account-related: the default handles (tracked for
 * every campaign), plus extra accounts grouped by the campaign they belong
 * to, with the add form inline. Replaces the separate "Social handles" and
 * "Extra accounts" cards so the account→campaign mapping reads top to bottom.
 */
export function CreatorAccountsCard({
  creatorId,
  tiktokHandle,
  instagramHandle,
  youtubeHandle,
  fallbackHandle,
  accounts,
  campaigns,
}: Props) {
  const router = useRouter();
  const [tt, setTt] = useState(tiktokHandle ?? "");
  const [ig, setIg] = useState(instagramHandle ?? "");
  const [yt, setYt] = useState(youtubeHandle ?? "");
  const [savingHandles, setSavingHandles] = useState(false);

  const [platform, setPlatform] = useState<string>("TIKTOK");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function saveHandles() {
    setSavingHandles(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktokHandle: tt.trim() || null,
          instagramHandle: ig.trim() || null,
          youtubeHandle: yt.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("Could not save handles");
        return;
      }
      toast.success("Handles saved");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSavingHandles(false);
    }
  }

  async function addAccount() {
    if (!handle.trim()) {
      toast.error("Enter a handle");
      return;
    }
    setAdding(true);
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
      setAdding(false);
    }
  }

  async function toggleAccount(account: Account) {
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

  const sharedExtras = accounts.filter((a) => !a.campaignId);
  const byCampaign = campaigns.map((c) => ({
    campaign: c,
    accounts: accounts.filter((a) => a.campaignId === c.id),
  }));

  function AccountRow({ a }: { a: Account }) {
    return (
      <li className="flex items-center gap-3 px-3 py-2.5">
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
          </p>
          {a.note && <p className="truncate text-xs text-slate-400">{a.note}</p>}
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
          onClick={() => toggleAccount(a)}
        >
          {a.isActive ? "Deactivate" : "Reactivate"}
        </Button>
      </li>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Social accounts
        </h3>
        <p className="text-xs text-slate-500">
          Default handles are tracked for <span className="font-medium">every</span>{" "}
          campaign. Below them, each campaign lists its own extra accounts —
          e.g. a different handle for one campaign, or a replacement after a
          shadow ban. Deactivating an account stops syncing it without losing
          its history.
        </p>
      </div>

      {/* Defaults — every campaign */}
      <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Default handles — every campaign
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs text-slate-600">
              <Music2 className="h-3 w-3" />
              TikTok
              <HandleLink platform="TIKTOK" handle={tt} />
            </Label>
            <Input
              placeholder={fallbackHandle}
              value={tt}
              onChange={(e) => setTt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs text-slate-600">
              <Camera className="h-3 w-3" />
              Instagram
              <HandleLink platform="INSTAGRAM" handle={ig} />
            </Label>
            <Input
              placeholder="their.insta.handle"
              value={ig}
              onChange={(e) => setIg(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-xs text-slate-600">
              <MonitorPlay className="h-3 w-3" />
              YouTube (Shorts)
              <HandleLink platform="YOUTUBE" handle={yt} />
            </Label>
            <Input
              placeholder="their.channel.name"
              value={yt}
              onChange={(e) => setYt(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-400">
            Without the @ — creators can also set these on their own profile
          </p>
          <Button
            type="button"
            size="sm"
            onClick={saveHandles}
            disabled={savingHandles}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Save className="mr-2 h-3.5 w-3.5" />
            {savingHandles ? "Saving..." : "Save handles"}
          </Button>
        </div>
        {sharedExtras.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
            {sharedExtras.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </div>

      {/* Per-campaign accounts */}
      <div className="mt-3 space-y-3">
        {byCampaign.map(({ campaign, accounts: campAccounts }) => (
          <div
            key={campaign.id}
            className="rounded-lg border border-slate-100 p-4"
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {campaign.name}
              {!campaign.isActive && " · ended"}
              {!campaign.onCampaign && (
                <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-700">
                  cut from campaign
                </span>
              )}
            </p>
            {campAccounts.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {campAccounts.map((a) => (
                  <AccountRow key={a.id} a={a} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">
                Uses the default handles only
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add an extra account */}
      <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add an extra account
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36">
            <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
              <SelectTrigger>
                <SelectValue>
                  {ACTIVE_PLATFORMS.find((p) => p.value === platform)?.label ??
                    platform}
                </SelectValue>
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
                <SelectValue>
                  {campaignId === "all"
                    ? "All campaigns"
                    : campaigns.find((c) => c.id === campaignId)?.name ??
                      "All campaigns"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns
                  .filter((c) => c.onCampaign)
                  .map((c) => (
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
            onClick={addAccount}
            disabled={adding}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {adding ? "Adding..." : "Add account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
