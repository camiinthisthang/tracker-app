"use client";

import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
}

interface HookOption {
  id: string;
  text: string;
  category: string | null;
}

const ONBOARDING_OPTION_ID = "__onboarding_docs__";
const FREESTYLE_HOOK_ID = "__freestyle__";
const NO_HOOK_ID = "__none__";

export function CreatorUploadForm({
  campaigns,
  hooks = [],
}: {
  campaigns: Campaign[];
  hooks?: HookOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [campaignId, setCampaignId] = useState(
    campaigns[0]?.id ?? ONBOARDING_OPTION_ID
  );
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [hookSelection, setHookSelection] = useState<string>(NO_HOOK_ID);
  const [freestyleHook, setFreestyleHook] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId || !fileName || !fileUrl) {
      toast.error("Please fill in all fields");
      return;
    }

    const isOnboarding = campaignId === ONBOARDING_OPTION_ID;
    let hookId: string | null = null;
    let freestyle: string | null = null;
    if (!isOnboarding) {
      if (hookSelection === FREESTYLE_HOOK_ID) {
        if (!freestyleHook.trim()) {
          toast.error("Type your freestyle hook or switch to a defined one");
          return;
        }
        freestyle = freestyleHook.trim();
      } else if (hookSelection !== NO_HOOK_ID) {
        hookId = hookSelection;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: isOnboarding ? null : campaignId,
          category: isOnboarding ? "ONBOARDING_DOCS" : "CONTENT",
          fileName,
          fileUrl,
          fileSize: 0,
          hookId,
          freestyleHook: freestyle,
        }),
      });

      if (!res.ok) {
        toast.error("Upload failed");
        return;
      }

      toast.success("Video submitted for review!");
      setFileName("");
      setFileUrl("");
      setHookSelection(NO_HOOK_ID);
      setFreestyleHook("");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
          <Upload className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Submit a video for review
          </h3>
          <p className="text-xs text-slate-400">
            Upload your video to cloud storage, then paste the link here.
            Your manager will review and give feedback in-app.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">Campaign</Label>
          <Select
            value={campaignId}
            onValueChange={(v) => v && setCampaignId(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a campaign">
                {campaignId === ONBOARDING_OPTION_ID
                  ? "Tax form / ID"
                  : campaigns.find((c) => c.id === campaignId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value={ONBOARDING_OPTION_ID}>
                Tax form / ID (onboarding)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Video filename
          </Label>
          <Input
            placeholder="my-video.mp4"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Video URL
          </Label>
          <Input
            placeholder="https://drive.google.com/..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
          />
        </div>
      </div>

      {campaignId !== ONBOARDING_OPTION_ID && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-slate-700">
              Hook (optional)
            </Label>
            <Select
              value={hookSelection}
              onValueChange={(v) => v && setHookSelection(v)}
            >
              <SelectTrigger>
                <SelectValue>
                  {hookSelection === NO_HOOK_ID && "No hook"}
                  {hookSelection === FREESTYLE_HOOK_ID && "Freestyle…"}
                  {hookSelection !== NO_HOOK_ID &&
                    hookSelection !== FREESTYLE_HOOK_ID &&
                    hooks.find((h) => h.id === hookSelection)?.text}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HOOK_ID}>No hook</SelectItem>
                {hooks.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.text}
                  </SelectItem>
                ))}
                <SelectItem value={FREESTYLE_HOOK_ID}>
                  Freestyle: type your own…
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hookSelection === FREESTYLE_HOOK_ID && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                Your hook
              </Label>
              <Input
                placeholder="POV: my first…"
                value={freestyleHook}
                onChange={(e) => setFreestyleHook(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          className="bg-slate-900 text-white hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? (
            "Submitting..."
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Submit for review
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
