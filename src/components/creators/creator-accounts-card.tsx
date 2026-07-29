"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Music2,
  Camera,
  MonitorPlay,
  Plus,
  ChevronDown,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { HandleLink } from "@/components/creators/handle-link";
import { ACTIVE_PLATFORMS, platformProfileUrl } from "@/lib/constants";

interface Account {
  id: string;
  platform: string;
  handle: string;
  isActive: boolean;
  isShadowbanned: boolean;
  note: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

interface CampaignRef {
  id: string;
  name: string;
  isActive: boolean;
  onCampaign: boolean; // false = creator was cut from this campaign
  useDefaultHandles: boolean; // track the creator's profile handles here too
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
 * Accounts are campaign-first: creators spin up fresh handles per campaign, so
 * each campaign lists its own accounts, and the creator's profile "default
 * handles" are an opt-in exception (collapsed, off unless a campaign toggles
 * "also track default handle"). Ended/cut campaigns collapse under Show more.
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

  const activeCampaigns = campaigns.filter((c) => c.isActive && c.onCampaign);
  const endedCampaigns = campaigns.filter((c) => !c.isActive || !c.onCampaign);

  const [platform, setPlatform] = useState<string>("TIKTOK");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [campaignId, setCampaignId] = useState<string>(
    activeCampaigns[0]?.id ?? "all"
  );
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [showEnded, setShowEnded] = useState(false);

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
      toast.success("Default handles saved");
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

  async function toggleShadowban(account: Account) {
    setTogglingId(account.id);
    try {
      const res = await fetch(
        `/api/creators/${creatorId}/accounts/${account.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isShadowbanned: !account.isShadowbanned }),
        }
      );
      if (!res.ok) {
        toast.error("Could not update account");
        return;
      }
      toast.success(
        account.isShadowbanned
          ? "Shadow-ban flag cleared for this handle"
          : "Handle marked shadow-banned — just a note on this handle; add their replacement handle below"
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
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

  async function toggleDefaultHandles(campaign: CampaignRef) {
    setTogglingId(campaign.id);
    try {
      const res = await fetch(
        `/api/campaigns/${campaign.id}/creators`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            useDefaultHandles: !campaign.useDefaultHandles,
          }),
        }
      );
      if (!res.ok) {
        toast.error("Could not update");
        return;
      }
      toast.success(
        campaign.useDefaultHandles
          ? `Stopped tracking default handles on ${campaign.name}`
          : `Now also tracking their default handles on ${campaign.name}`
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  const sharedExtras = accounts.filter((a) => !a.campaignId);

  async function saveHandleEdit(account: Account, newHandle: string) {
    const cleaned = newHandle.trim().replace(/^@+/, "");
    if (!cleaned || cleaned === account.handle) return true;
    const res = await fetch(
      `/api/creators/${creatorId}/accounts/${account.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleaned }),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      toast.error(j?.error ?? "Could not rename handle");
      return false;
    }
    toast.success("Handle updated — it syncs under the corrected name from the next run");
    router.refresh();
    return true;
  }

  async function deleteAccount(account: Account) {
    setTogglingId(account.id);
    try {
      const res = await fetch(
        `/api/creators/${creatorId}/accounts/${account.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        // Synced-posts guard: if this handle was simply WRONG (someone
        // else's account got scraped), offer to delete the posts with it —
        // that history was never this creator's to keep.
        if (res.status === 409 && typeof j?.postCount === "number") {
          const wipe = window.confirm(
            `@${account.handle} has ${j.postCount} synced post${
              j.postCount === 1 ? "" : "s"
            }.\n\nIf this handle was WRONG (it scraped someone else's account), click OK to delete the handle AND its ${j.postCount} post${
              j.postCount === 1 ? "" : "s"
            } — this can't be undone.\n\nIf it's a real past account of this creator, click Cancel and use Deactivate instead so the history keeps counting.`
          );
          if (wipe) {
            const forced = await fetch(
              `/api/creators/${creatorId}/accounts/${account.id}?deletePosts=true`,
              { method: "DELETE" }
            );
            if (forced.ok) {
              const fj = await forced.json().catch(() => null);
              toast.success(
                `Account removed along with ${fj?.deletedPosts ?? "its"} wrongly-synced post${
                  fj?.deletedPosts === 1 ? "" : "s"
                }`
              );
              router.refresh();
              return;
            }
            const fjErr = await forced.json().catch(() => null);
            toast.error(fjErr?.error ?? "Could not delete account");
            return;
          }
          return;
        }
        toast.error(j?.error ?? "Could not delete account");
        return;
      }
      toast.success("Account removed");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  async function moveAccount(account: Account, newCampaignId: string | null) {
    setTogglingId(account.id);
    try {
      const res = await fetch(
        `/api/creators/${creatorId}/accounts/${account.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: newCampaignId }),
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(j?.error ?? "Could not move the handle");
        return;
      }
      const moved = typeof j?.movedPosts === "number" ? j.movedPosts : 0;
      toast.success(
        newCampaignId
          ? `Moved @${account.handle}${
              moved
                ? ` and its ${moved} tracked post${moved === 1 ? "" : "s"}`
                : ""
            } — future syncs count it under the new campaign`
          : `@${account.handle} is now shared across campaigns`
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setTogglingId(null);
    }
  }

  // Plain render helpers (NOT nested components): calling a function inline
  // keeps the element type the stable top-level AccountRowItem, so its edit
  // state survives parent re-renders. A nested `function Row()` used as
  // <Row/> gets a new identity every render and React remounts the subtree.
  const renderAccountRow = (a: Account) => (
    <AccountRowItem
      key={a.id}
      a={a}
      campaigns={campaigns}
      togglingId={togglingId}
      saveHandleEdit={saveHandleEdit}
      toggleShadowban={toggleShadowban}
      toggleAccount={toggleAccount}
      deleteAccount={deleteAccount}
      moveAccount={moveAccount}
    />
  );

  const renderCampaignSection = (c: CampaignRef) => {
    const campAccounts = accounts.filter((a) => a.campaignId === c.id);
    return (
      <div key={c.id} className="rounded-lg border border-slate-100 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {c.name}
            {!c.isActive && " · ended"}
            {c.isActive && !c.onCampaign && (
              <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-700">
                cut from campaign
              </span>
            )}
          </p>
          <label
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500"
            title="Off (default): only this campaign's own accounts are tracked. On: also sync the creator's profile default handles for this campaign."
          >
            <Switch
              checked={c.useDefaultHandles}
              disabled={togglingId === c.id}
              onCheckedChange={() => toggleDefaultHandles(c)}
            />
            Also track default handle
          </label>
        </div>
        {campAccounts.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            {campAccounts.map(renderAccountRow)}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">
            {c.useDefaultHandles
              ? "No campaign-specific accounts — tracking their default handles."
              : "No accounts yet — add the handle(s) they're using for this campaign below."}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-800">
          Social accounts
        </h3>
        <p className="text-xs text-slate-500">
          Tracked per campaign — creators use fresh handles for each campaign,
          so add the account(s) they&apos;re running under each one. Deactivating
          an account stops syncing it without losing its history.
        </p>
      </div>

      {/* Active campaigns — the primary view */}
      <div className="space-y-3">
        {activeCampaigns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-400">
            Not on any active campaign. Assign this creator to a campaign to
            start tracking their accounts.
          </p>
        ) : (
          activeCampaigns.map(renderCampaignSection)
        )}
      </div>

      {/* Add an account (defaults to a campaign, not all-campaigns) */}
      <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add an account
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
          <div className="w-52">
            <Select
              value={campaignId}
              onValueChange={(v) => v && setCampaignId(v)}
            >
              <SelectTrigger>
                <SelectValue>
                  {campaignId === "all"
                    ? "All campaigns (rare)"
                    : activeCampaigns.find((c) => c.id === campaignId)?.name ??
                      "Pick a campaign"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {activeCampaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value="all">
                  All campaigns (shared — rare)
                </SelectItem>
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

      {/* Ended / cut campaigns — collapsed */}
      {endedCampaigns.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowEnded((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showEnded ? "rotate-180" : ""}`}
            />
            {showEnded ? "Hide" : "Show"} ended / cut campaigns (
            {endedCampaigns.length})
          </button>
          {showEnded && (
            <div className="mt-2 space-y-3">
              {endedCampaigns.map(renderCampaignSection)}
            </div>
          )}
        </div>
      )}

      {/* Default handles — advanced, collapsed */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowDefaults((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showDefaults ? "rotate-180" : ""}`}
          />
          Default profile handles (advanced)
        </button>
        {showDefaults && (
          <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-[11px] text-slate-500">
              A creator&apos;s profile handles. These are <b>not</b> tracked on a
              campaign unless that campaign&apos;s &quot;Also track default
              handle&quot; toggle is on — most Canvas UGC creators use fresh
              per-campaign handles instead.
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
            <div className="mt-2 flex items-center justify-end">
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
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Shared extra accounts (all campaigns)
                </p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-white">
                  {sharedExtras.map(renderAccountRow)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One account row with inline handle editing. Top-level (not nested in the
 * card) so its edit state survives parent re-renders. */
function AccountRowItem({
  a,
  campaigns,
  togglingId,
  saveHandleEdit,
  toggleShadowban,
  toggleAccount,
  deleteAccount,
  moveAccount,
}: {
  a: Account;
  campaigns: CampaignRef[];
  togglingId: string | null;
  saveHandleEdit: (a: Account, h: string) => Promise<boolean>;
  toggleShadowban: (a: Account) => void;
  toggleAccount: (a: Account) => void;
  deleteAccount: (a: Account) => void;
  moveAccount: (a: Account, campaignId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.handle);
  const [savingEdit, setSavingEdit] = useState(false);

  async function commitEdit() {
    setSavingEdit(true);
    const ok = await saveHandleEdit(a, draft);
    setSavingEdit(false);
    if (ok) setEditing(false);
  }

  return (
      <li className="flex items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                className="h-8 w-48"
                value={draft}
                autoFocus
                disabled={savingEdit}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") {
                    setDraft(a.handle);
                    setEditing(false);
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={savingEdit}
                onClick={commitEdit}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {savingEdit ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={savingEdit}
                onClick={() => {
                  setDraft(a.handle);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
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
                {ACTIVE_PLATFORMS.find((p) => p.value === a.platform)?.label ??
                  a.platform}
              </span>
              <button
                type="button"
                title="Fix a typo in this handle"
                onClick={() => setEditing(true)}
                className="ml-1.5 align-middle text-slate-300 hover:text-slate-600"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </p>
          )}
          {a.note && !editing && (
            <p className="truncate text-xs text-slate-400">{a.note}</p>
          )}
        </div>
        <div className="w-44">
          <Select
            value={a.campaignId ?? "all"}
            onValueChange={(v) => {
              if (!v) return;
              const next = v === "all" ? null : v;
              if (next !== (a.campaignId ?? null)) moveAccount(a, next);
            }}
          >
            <SelectTrigger
              className="h-8 text-xs"
              disabled={togglingId === a.id}
              title="Which campaign this handle is tracked under. Moving it also moves its already-synced posts, so the new campaign gets the full history."
            >
              <SelectValue>
                {a.campaignId
                  ? (campaigns.find((c) => c.id === a.campaignId)?.name ??
                    a.campaignName ??
                    "Campaign")
                  : "All campaigns"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive && " (ended)"}
                </SelectItem>
              ))}
              <SelectItem value="all">All campaigns (shared)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {a.isShadowbanned && (
          <span
            title="This handle is shadow-banned — a note on the handle only; pacing continues on their other handles"
            className="cursor-help rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600"
          >
            Shadow-banned
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            a.isActive
              ? "bg-green-50 text-green-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {a.isActive ? "Syncing" : "Inactive"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={togglingId === a.id}
          title="Flag or clear a shadow-ban on this handle only"
          onClick={() => toggleShadowban(a)}
          className={a.isShadowbanned ? "text-violet-600" : "text-slate-500"}
        >
          {a.isShadowbanned ? "Clear SB" : "Mark SB"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={togglingId === a.id}
          onClick={() => toggleAccount(a)}
        >
          {a.isActive ? "Deactivate" : "Reactivate"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={togglingId === a.id}
          title="Delete this handle — only allowed when it has no synced posts (use Deactivate to keep history)"
          onClick={() => deleteAccount(a)}
          className="h-8 w-8 p-0 text-slate-300 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </li>
    );
}
