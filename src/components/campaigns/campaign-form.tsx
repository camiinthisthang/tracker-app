"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignCreatorInput } from "@/lib/validations/campaign";

interface CreatorRow extends CampaignCreatorInput {
  id: string;
}

interface AvailableCreator {
  id: string;
  name: string;
  handle: string;
}

interface AvailableTeam {
  id: string;
  name: string;
}

interface CampaignFormProps {
  campaignId?: string;
  availableCreators?: AvailableCreator[];
  // When provided, surface a "Client" dropdown at the top of the form. Only
  // passed in for agency super admins / agency managers on the create flow.
  // Edit flow + client managers don't see it.
  availableTeams?: AvailableTeam[];
  initialData?: {
    name: string;
    isActive: boolean;
    startDate: string;
    endDate: string;
    hashtags: string[];
    weeklyPostTarget: number;
    previewLinks: string[];
    galleryUrls: string[];
    creators: CreatorRow[];
  };
}

export function CampaignForm({
  campaignId,
  availableCreators = [],
  availableTeams,
  initialData,
}: CampaignFormProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isEdit = !!campaignId;
  const showTeamPicker = !isEdit && availableTeams !== undefined;
  const [teamId, setTeamId] = useState(
    showTeamPicker && availableTeams!.length === 1 ? availableTeams![0].id : ""
  );

  // Campaign fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [startDate, setStartDate] = useState(initialData?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialData?.endDate ?? "");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>(initialData?.hashtags ?? []);
  const [weeklyPostTarget, setWeeklyPostTarget] = useState(
    String(initialData?.weeklyPostTarget ?? 5)
  );
  const [previewLinkInput, setPreviewLinkInput] = useState("");
  const [previewLinks, setPreviewLinks] = useState<string[]>(initialData?.previewLinks ?? []);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialData?.galleryUrls ?? []);

  // Creator rows
  const [creators, setCreators] = useState<CreatorRow[]>(initialData?.creators ?? []);
  // Creators present when the form loaded. On save we DELETE any of these that
  // were removed from the list — the PATCH endpoint only upserts what's sent,
  // it never deletes, so without this removals don't actually stick.
  const initialCreatorIds = useRef(
    new Set(
      (initialData?.creators ?? [])
        .map((c) => c.creatorId)
        .filter((id): id is string => !!id)
    )
  );

  function addCreatorRow() {
    setCreators([
      ...creators,
      {
        id: crypto.randomUUID(),
        creatorId: "",
        platform: "TIKTOK",
        videosPerDay: 1,
        monthlyPostGoal: null,
        isActive: true,
      },
    ]);
  }

  function updateCreator(id: string, field: string, value: string | number | boolean | null) {
    setCreators(
      creators.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  // Trash button. For a creator that's already on the campaign, this is a soft
  // "cut": flip isActive=false so we keep their posts/history but stop syncing
  // and stop expecting future posts. For a brand-new unsaved row, just drop it.
  function removeCreator(id: string) {
    const row = creators.find((c) => c.id === id);
    if (row && row.creatorId && initialCreatorIds.current.has(row.creatorId)) {
      setCreators(
        creators.map((c) => (c.id === id ? { ...c, isActive: false } : c))
      );
    } else {
      setCreators(creators.filter((c) => c.id !== id));
    }
  }

  function addHashtag() {
    const tag = hashtagInput.trim();
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag.startsWith("#") ? tag : `#${tag}`]);
      setHashtagInput("");
    }
  }

  function addPreviewLink() {
    const link = previewLinkInput.trim();
    if (link) {
      setPreviewLinks([...previewLinks, link]);
      setPreviewLinkInput("");
    }
  }

  function addGalleryUrl() {
    const url = galleryUrlInput.trim();
    if (url) {
      setGalleryUrls([...galleryUrls, url]);
      setGalleryUrlInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (showTeamPicker && !teamId) {
      setError("Pick a client to create the campaign under");
      return;
    }

    setLoading(true);

    try {
      const url = isEdit ? `/api/campaigns/${campaignId}` : "/api/campaigns";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          isActive,
          startDate,
          endDate,
          hashtags,
          weeklyPostTarget: parseInt(weeklyPostTarget),
          previewLinks,
          galleryUrls,
          creators: creators.map(({ id, ...rest }) => rest),
          ...(showTeamPicker ? { teamId } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || (isEdit ? "Failed to update campaign" : "Failed to create campaign"));
        setLoading(false);
        return;
      }

      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}/overview`);
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {showTeamPicker && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-800">Client</h3>
          <p className="text-xs text-slate-400">
            Which client this campaign belongs to. Only their managers will see
            it on their dashboard.
          </p>
          <div className="mt-3 max-w-md">
            <Select value={teamId} onValueChange={(v) => setTeamId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams!.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">
                    No clients yet — add one on /clients first.
                  </div>
                ) : (
                  availableTeams!.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Campaign Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Campaign details
            </h3>
            <p className="text-xs text-slate-400">
              Information on the campaign itself.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Campaign name
            </Label>
            <Input
              placeholder="My Campaign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Label className="text-sm font-medium text-slate-700">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-800">Duration</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Start date
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              End date
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Hashtags */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-800">
          Hashtags{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Optional labels for the campaign. We track every post from each
          creator&apos;s account within the campaign dates — hashtags don&apos;t
          filter what gets pulled.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="#sponsored, #ad, #partnership"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHashtag();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addHashtag}
          >
            Add
          </Button>
        </div>
        {hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setHashtags(hashtags.filter((t) => t !== tag))
                  }
                >
                  <X className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Preview Link Resources */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-800">
          Preview link resources{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </h3>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="https://..."
            value={previewLinkInput}
            onChange={(e) => setPreviewLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPreviewLink();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addPreviewLink}>
            <Plus className="mr-1 h-4 w-4" />
            Add link
          </Button>
        </div>
        {previewLinks.length > 0 && (
          <ul className="mt-3 space-y-1">
            {previewLinks.map((link, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
              >
                <span className="truncate">{link}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewLinks(previewLinks.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Gallery / Inspo */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-800">
          Gallery / Inspo{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </h3>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="https://www.tiktok.com/..."
            value={galleryUrlInput}
            onChange={(e) => setGalleryUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addGalleryUrl();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addGalleryUrl}>
            <Plus className="mr-1 h-4 w-4" />
            Add TikTok URL
          </Button>
        </div>
        {galleryUrls.length > 0 && (
          <ul className="mt-3 space-y-1">
            {galleryUrls.map((url, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
              >
                <span className="truncate">{url}</span>
                <button
                  type="button"
                  onClick={() =>
                    setGalleryUrls(galleryUrls.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Posting Requirements */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-800">
          Posting requirements
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Total number of videos required across all creators each week.
        </p>
        <div className="mt-3 w-48">
          <Label className="text-sm font-medium text-slate-700">
            Weekly post target
          </Label>
          <Input
            type="number"
            min={0}
            value={weeklyPostTarget}
            onChange={(e) => setWeeklyPostTarget(e.target.value)}
          />
        </div>
      </div>

      {/* Creators on this campaign */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Creators on this campaign
            </h3>
            <p className="text-xs text-slate-400">
              Pick from your team&apos;s roster. Creators set their own TikTok
              / Instagram handles on their profile — you don&apos;t type them
              here.
            </p>
          </div>
        </div>

        {creators.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="hidden grid-cols-[1fr_100px_120px_60px_40px] gap-3 sm:grid">
              <span className="text-xs font-medium text-gray-500">Creator</span>
              <span className="text-xs font-medium text-gray-500">
                Videos per day
              </span>
              <span className="text-xs font-medium text-gray-500">
                Monthly goal
              </span>
              <span className="text-xs font-medium text-gray-500">Active</span>
              <span />
            </div>
            <Separator />
            {creators.map((creator) => {
              const pickedIds = new Set(
                creators
                  .filter((c) => c.id !== creator.id && c.creatorId)
                  .map((c) => c.creatorId),
              );
              const selectableCreators = availableCreators.filter(
                (ac) => !pickedIds.has(ac.id),
              );
              const selected = availableCreators.find(
                (ac) => ac.id === creator.creatorId,
              );
              return (
                <div
                  key={creator.id}
                  className={`grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px_120px_60px_40px] sm:items-center ${
                    creator.isActive ? "" : "opacity-60"
                  }`}
                >
                  <Select
                    value={creator.creatorId}
                    onValueChange={(v) =>
                      v && updateCreator(creator.id, "creatorId", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a creator">
                        {selected ? (
                          <span className="flex items-center gap-2">
                            {!creator.isActive && (
                              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Cut
                              </span>
                            )}
                            {selected.name} · @{selected.handle}
                          </span>
                        ) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {selectableCreators.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400">
                          No more creators on this team.
                        </div>
                      ) : (
                        selectableCreators.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{" "}
                            <span className="text-slate-400">· @{c.handle}</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={creator.videosPerDay}
                    onChange={(e) =>
                      updateCreator(
                        creator.id,
                        "videosPerDay",
                        parseInt(e.target.value) || 1,
                      )
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 40"
                    value={creator.monthlyPostGoal ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateCreator(
                        creator.id,
                        "monthlyPostGoal",
                        raw === "" ? null : parseInt(raw) || null,
                      );
                    }}
                  />
                  <Switch
                    checked={creator.isActive}
                    onCheckedChange={(v) =>
                      updateCreator(creator.id, "isActive", v)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                    onClick={() => removeCreator(creator.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={addCreatorRow}
          disabled={availableCreators.length === 0}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add creator
        </Button>
        {availableCreators.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            No creators on this team yet. Add one first from the{" "}
            <Link href="/creators" className="text-blue-600 hover:underline">
              Creators
            </Link>{" "}
            tab.
          </p>
        )}

        {creators.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Total active: {creators.filter((c) => c.isActive).length}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-slate-800 text-white hover:bg-slate-700"
          disabled={loading}
        >
          {loading ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Campaign")}
        </Button>
      </div>
    </form>
  );
}
