"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Send, Undo2, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export interface WorkshopHookRow {
  id: string;
  onScreenText: string;
  caption: string | null;
  videoDirection: string | null;
  campaignId: string | null;
  campaign: { id: string; name: string } | null;
  publishedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string } | null;
  isActive: boolean;
  usedByCount: number;
}

interface CampaignOption {
  id: string;
  name: string;
}

interface Props {
  workshop: WorkshopHookRow[];
  published: WorkshopHookRow[];
  campaigns: CampaignOption[];
}

type Tab = "workshop" | "published";

export function WorkshopHooksManager({ workshop, published, campaigns }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("workshop");
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Hook workshop</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Workshop hooks together, then publish them to a campaign so the
            creators on it see them on their dashboard.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          <Plus className="mr-1 h-4 w-4" />
          Quick add
        </Button>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
        <TabButton active={tab === "workshop"} onClick={() => setTab("workshop")}>
          Workshop ({workshop.length})
        </TabButton>
        <TabButton
          active={tab === "published"}
          onClick={() => setTab("published")}
        >
          Published ({published.length})
        </TabButton>
      </div>

      <div className="p-5">
        {tab === "workshop" ? (
          <HookList
            hooks={workshop}
            campaigns={campaigns}
            stage="workshop"
            onChange={() => router.refresh()}
            emptyMessage="No drafts yet. Quick-add one above to start workshopping."
          />
        ) : (
          <HookList
            hooks={published}
            campaigns={campaigns}
            stage="published"
            onChange={() => router.refresh()}
            emptyMessage="Nothing published yet. Workshop a hook and click Publish to send it out."
          />
        )}
      </div>

      <QuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        campaigns={campaigns}
        onCreated={() => {
          setQuickAddOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function HookList({
  hooks,
  campaigns,
  stage,
  onChange,
  emptyMessage,
}: {
  hooks: WorkshopHookRow[];
  campaigns: CampaignOption[];
  stage: Tab;
  onChange: () => void;
  emptyMessage: string;
}) {
  if (hooks.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-3">
      {hooks.map((h) => (
        <HookCard
          key={h.id}
          hook={h}
          campaigns={campaigns}
          stage={stage}
          onChange={onChange}
        />
      ))}
    </ul>
  );
}

function HookCard({
  hook,
  campaigns,
  stage,
  onChange,
}: {
  hook: WorkshopHookRow;
  campaigns: CampaignOption[];
  stage: Tab;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [onScreenText, setOnScreenText] = useState(hook.onScreenText);
  const [caption, setCaption] = useState(hook.caption ?? "");
  const [videoDirection, setVideoDirection] = useState(hook.videoDirection ?? "");
  const [campaignId, setCampaignId] = useState(hook.campaignId ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!onScreenText.trim()) {
      toast.error("On-screen text can't be empty");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/hooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onScreenText,
        caption,
        videoDirection,
        campaignId: campaignId || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Failed to update hook");
      return;
    }
    toast.success("Saved");
    setEditing(false);
    onChange();
  }

  async function publish() {
    if (!campaignId && !hook.campaignId) {
      toast.error("Pick a campaign first");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/hooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publish: true,
        ...(campaignId ? { campaignId } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to publish");
      return;
    }
    toast.success("Published");
    onChange();
  }

  async function unpublish() {
    setBusy(true);
    const res = await fetch(`/api/hooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish: false }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Failed to unpublish");
      return;
    }
    toast.success("Moved back to workshop");
    onChange();
  }

  async function del() {
    if (!confirm(`Delete this hook? "${hook.onScreenText.slice(0, 60)}"`)) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/hooks/${hook.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Hook deleted");
    onChange();
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">
              On-screen text
            </Label>
            <Input
              value={onScreenText}
              onChange={(e) => setOnScreenText(e.target.value)}
              placeholder="The words on the video"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Caption</Label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What goes under the post"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Face / video direction
            </Label>
            <Input
              value={videoDirection}
              onChange={(e) => setVideoDirection(e.target.value)}
              placeholder="What the creator is doing on camera (e.g. 'POV walking into store, surprised face')"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Campaign</Label>
            <Select
              value={campaignId}
              onValueChange={(v) => setCampaignId(v ?? "")}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pick a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={busy}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  const isPublished = stage === "published";

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium text-slate-900">
            {hook.onScreenText}
          </p>
          {hook.caption && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Caption:</span>{" "}
              {hook.caption}
            </p>
          )}
          {hook.videoDirection && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Video:</span>{" "}
              {hook.videoDirection}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
            {hook.campaign ? (
              <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                {hook.campaign.name}
              </Badge>
            ) : (
              <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">
                No campaign yet
              </Badge>
            )}
            {isPublished && (
              <span>
                Used by {hook.usedByCount}{" "}
                {hook.usedByCount === 1 ? "creator" : "creators"}
              </span>
            )}
            {isPublished && hook.publishedAt && (
              <span>· Published {format(new Date(hook.publishedAt), "MMM d")}</span>
            )}
            {hook.createdBy && (
              <span>
                · By{" "}
                {hook.createdBy.name ??
                  hook.createdBy.email.split("@")[0] ??
                  "—"}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!isPublished ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={publish}
              disabled={busy}
              title="Publish"
              className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={unpublish}
              disabled={busy}
              title="Move back to workshop"
              className="text-slate-500 hover:bg-slate-50"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={del}
            disabled={busy}
            title="Delete"
            className="text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function QuickAddDialog({
  open,
  onClose,
  campaigns,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  campaigns: CampaignOption[];
  onCreated: () => void;
}) {
  const [onScreenText, setOnScreenText] = useState("");
  const [caption, setCaption] = useState("");
  const [videoDirection, setVideoDirection] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOnScreenText("");
    setCaption("");
    setVideoDirection("");
    setCampaignId("");
  }

  async function submit(publish: boolean) {
    if (!onScreenText.trim()) {
      toast.error("On-screen text is required");
      return;
    }
    if (publish && !campaignId) {
      toast.error("Pick a campaign to publish to");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/hooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onScreenText,
        caption,
        videoDirection,
        campaignId: campaignId || null,
        publish,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to add hook");
      return;
    }
    toast.success(publish ? "Hook published" : "Saved to workshop");
    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : (reset(), onClose()))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a hook</DialogTitle>
          <DialogDescription>
            Park it in workshop to refine, or send it straight live to a campaign.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-slate-700">
              On-screen text
            </Label>
            <Input
              value={onScreenText}
              onChange={(e) => setOnScreenText(e.target.value)}
              placeholder="The words that appear on the video"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Caption</Label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What goes under the post"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Face / video direction
            </Label>
            <Input
              value={videoDirection}
              onChange={(e) => setVideoDirection(e.target.value)}
              placeholder="POV walking into store, surprised face..."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Campaign{" "}
              <span className="font-normal text-slate-400">
                (required to publish)
              </span>
            </Label>
            <Select
              value={campaignId}
              onValueChange={(v) => setCampaignId(v ?? "")}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="None — save to workshop" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
          >
            <X className="mr-1 h-4 w-4" />
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => submit(false)}
            disabled={busy}
          >
            Save to workshop
          </Button>
          <Button
            onClick={() => submit(true)}
            disabled={busy}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Send className="mr-1 h-4 w-4" />
            Publish now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
