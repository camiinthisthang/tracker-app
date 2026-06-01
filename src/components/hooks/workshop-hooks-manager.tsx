"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Send, Undo2, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  prompt: string | null;
  ponchoPrompt: string | null;
  inspirationLink: string | null;
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
  const [unpublishAllOpen, setUnpublishAllOpen] = useState(false);
  const [unpublishingAll, setUnpublishingAll] = useState(false);

  async function unpublishAll() {
    setUnpublishingAll(true);
    try {
      const res = await fetch("/api/hooks/unpublish-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to unpublish all");
        return;
      }
      const n = typeof data.updatedCount === "number" ? data.updatedCount : 0;
      toast.success(
        n === 0
          ? "Nothing to unpublish — all hooks were already in Workshop."
          : `Moved ${n} hook${n === 1 ? "" : "s"} back to Workshop.`
      );
      setUnpublishAllOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUnpublishingAll(false);
    }
  }

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
        <div className="flex items-center gap-2">
          {published.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnpublishAllOpen(true)}
            >
              <Undo2 className="mr-1 h-4 w-4" />
              Unpublish all
            </Button>
          )}
          <Button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="mr-1 h-4 w-4" />
            Quick add
          </Button>
        </div>
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

      <Dialog open={unpublishAllOpen} onOpenChange={setUnpublishAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish all hooks?</DialogTitle>
            <DialogDescription>
              All {published.length} published hook{published.length === 1 ? "" : "s"}{" "}
              will move back to the Workshop tab. Hook content is preserved —
              you can publish them again later or delete them individually.
              Creators will stop seeing them on their dashboards immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnpublishAllOpen(false)}
              disabled={unpublishingAll}
            >
              Cancel
            </Button>
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={unpublishAll}
              disabled={unpublishingAll}
            >
              {unpublishingAll ? "Unpublishing…" : "Unpublish all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

// Shared field block: label + helper text + control. Keeps every field in the
// workshop and quick-add dialog visually consistent and self-explanatory.
function FieldRow({
  label,
  helper,
  optional,
  children,
}: {
  label: string;
  helper: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-slate-700">
        {label}
        {optional ? (
          <span className="font-normal text-slate-400"> (optional)</span>
        ) : null}
      </Label>
      <p className="mb-1 text-[11px] leading-snug text-slate-400">{helper}</p>
      {children}
    </div>
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
  const [prompt, setPrompt] = useState(hook.prompt ?? "");
  const [ponchoPrompt, setPonchoPrompt] = useState(hook.ponchoPrompt ?? "");
  const [inspirationLink, setInspirationLink] = useState(
    hook.inspirationLink ?? ""
  );
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
        prompt,
        ponchoPrompt,
        inspirationLink,
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
          <FieldRow
            label="On-screen text"
            helper="The short overlay text shown on the video itself. Keep it punchy — under ~6 words is ideal."
          >
            <Input
              value={onScreenText}
              onChange={(e) => setOnScreenText(e.target.value)}
              placeholder="e.g. POV: you finally found a manicure that pays you back"
            />
          </FieldRow>
          <FieldRow
            label="Spoken voice"
            helper="What the creator says out loud. Leave blank for silent / text-only videos."
            optional
          >
            <Textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. ‘I just tapped my nail and landed a collab. This is wild.’"
            />
          </FieldRow>
          <FieldRow
            label="Face / video direction"
            helper="What the creator does on camera so the shot is obvious before they hit record."
            optional
          >
            <Input
              value={videoDirection}
              onChange={(e) => setVideoDirection(e.target.value)}
              placeholder="e.g. POV walking into store, surprised face"
            />
          </FieldRow>
          <FieldRow
            label="Caption"
            helper="Goes under the post on TikTok / Instagram."
            optional
          >
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. the chipped nail era is here ✨"
            />
          </FieldRow>
          <FieldRow
            label="Poncho prompt"
            helper="Ready-to-paste prompt for Poncho when this hook needs an AI image or screen. Use a random person (not a real identifiable one), simple background, minimal on-image text."
            optional
          >
            <Textarea
              rows={3}
              value={ponchoPrompt}
              onChange={(e) => setPonchoPrompt(e.target.value)}
              placeholder="e.g. a young woman holding her phone showing a chipped nail, soft natural lighting, plain wall background, realistic, no text"
              className="font-mono text-xs"
            />
          </FieldRow>
          <FieldRow
            label="Inspiration link"
            helper="An example or reference video that shows creators what good looks like."
            optional
          >
            <Input
              type="url"
              value={inspirationLink}
              onChange={(e) => setInspirationLink(e.target.value)}
              placeholder="https://www.tiktok.com/@creator/video/123…"
            />
          </FieldRow>
          <FieldRow
            label="Campaign"
            helper="Which campaign this hook belongs to. Creators on that campaign will see it."
          >
            <Select
              value={campaignId}
              onValueChange={(v) => setCampaignId(v ?? "")}
            >
              <SelectTrigger>
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
          </FieldRow>
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
          {hook.prompt && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Spoken voice:</span>{" "}
              {hook.prompt}
            </p>
          )}
          {hook.videoDirection && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Video:</span>{" "}
              {hook.videoDirection}
            </p>
          )}
          {hook.caption && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Caption:</span>{" "}
              {hook.caption}
            </p>
          )}
          {hook.ponchoPrompt && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Poncho prompt:</span>{" "}
              <span className="font-mono text-[11px]">{hook.ponchoPrompt}</span>
            </p>
          )}
          {hook.inspirationLink && (
            <p className="text-xs text-slate-600">
              <span className="font-medium text-slate-500">Inspiration:</span>{" "}
              <a
                href={hook.inspirationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                {hook.inspirationLink}
                <ExternalLink className="h-3 w-3" />
              </a>
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
  const [prompt, setPrompt] = useState("");
  const [ponchoPrompt, setPonchoPrompt] = useState("");
  const [inspirationLink, setInspirationLink] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setOnScreenText("");
    setCaption("");
    setVideoDirection("");
    setPrompt("");
    setPonchoPrompt("");
    setInspirationLink("");
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
        prompt,
        ponchoPrompt,
        inspirationLink,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a hook</DialogTitle>
          <DialogDescription>
            Only on-screen text is required. Fill in the rest so creators have
            everything they need to copy/paste and shoot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FieldRow
            label="On-screen text"
            helper="The short overlay text shown on the video itself. Keep it punchy — under ~6 words is ideal."
          >
            <Input
              value={onScreenText}
              onChange={(e) => setOnScreenText(e.target.value)}
              placeholder="e.g. POV: you finally found a manicure that pays you back"
              autoFocus
            />
          </FieldRow>
          <FieldRow
            label="Spoken voice"
            helper="What the creator says out loud. Leave blank for silent / text-only videos."
            optional
          >
            <Textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. ‘I just tapped my nail and landed a collab. This is wild.’"
            />
          </FieldRow>
          <FieldRow
            label="Face / video direction"
            helper="What the creator does on camera so the shot is obvious before they hit record."
            optional
          >
            <Input
              value={videoDirection}
              onChange={(e) => setVideoDirection(e.target.value)}
              placeholder="e.g. POV walking into store, surprised face"
            />
          </FieldRow>
          <FieldRow
            label="Caption"
            helper="Goes under the post on TikTok / Instagram."
            optional
          >
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. the chipped nail era is here ✨"
            />
          </FieldRow>
          <FieldRow
            label="Poncho prompt"
            helper="Ready-to-paste prompt for Poncho when this hook needs an AI image or screen. Use a random person (not a real identifiable one), simple background, minimal on-image text."
            optional
          >
            <Textarea
              rows={3}
              value={ponchoPrompt}
              onChange={(e) => setPonchoPrompt(e.target.value)}
              placeholder="e.g. a young woman holding her phone showing a chipped nail, soft natural lighting, plain wall background, realistic, no text"
              className="font-mono text-xs"
            />
          </FieldRow>
          <FieldRow
            label="Inspiration link"
            helper="An example or reference video that shows creators what good looks like."
            optional
          >
            <Input
              type="url"
              value={inspirationLink}
              onChange={(e) => setInspirationLink(e.target.value)}
              placeholder="https://www.tiktok.com/@creator/video/123…"
            />
          </FieldRow>
          <FieldRow
            label="Campaign"
            helper="Required to publish. Save to workshop first if you’re still drafting."
            optional
          >
            <Select
              value={campaignId}
              onValueChange={(v) => setCampaignId(v ?? "")}
            >
              <SelectTrigger>
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
          </FieldRow>
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
