"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle, Link as LinkIcon } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [campaignId, setCampaignId] = useState(
    campaigns[0]?.id ?? ONBOARDING_OPTION_ID,
  );
  // Upload mode — pick a file to upload, or paste an external link as a
  // fallback (for creators who host on Drive / Dropbox and prefer not to
  // re-upload).
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkFileName, setLinkFileName] = useState("");
  const [hookSelection, setHookSelection] = useState<string>(NO_HOOK_ID);
  const [freestyleHook, setFreestyleHook] = useState("");
  const [progress, setProgress] = useState(0);

  const isOnboarding = campaignId === ONBOARDING_OPTION_ID;

  async function uploadToR2(file: File): Promise<{
    fileUrl: string;
    fileSize: number;
    fileName: string;
  }> {
    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      }),
    });
    if (!presignRes.ok) {
      const data = await presignRes.json().catch(() => null);
      throw new Error(data?.error || "Couldn't get upload URL");
    }
    const { uploadUrl, publicUrl } = (await presignRes.json()) as {
      uploadUrl: string;
      publicUrl: string;
    };

    // Upload directly to R2 via a PUT with progress reporting.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(file);
    });

    return { fileUrl: publicUrl, fileSize: file.size, fileName: file.name };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let fileUrl = "";
    let fileSize = 0;
    let fileName = "";

    if (mode === "file") {
      if (!file) {
        toast.error("Pick a video file first");
        return;
      }
    } else {
      if (!linkUrl.trim() || !linkFileName.trim()) {
        toast.error("Add a link + filename");
        return;
      }
    }

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
    setProgress(0);

    try {
      if (mode === "file" && file) {
        const uploaded = await uploadToR2(file);
        fileUrl = uploaded.fileUrl;
        fileSize = uploaded.fileSize;
        fileName = uploaded.fileName;
      } else {
        fileUrl = linkUrl.trim();
        fileName = linkFileName.trim();
        fileSize = 0;
      }

      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: isOnboarding ? null : campaignId,
          category: isOnboarding ? "ONBOARDING_DOCS" : "CONTENT",
          fileName,
          fileUrl,
          fileSize,
          hookId,
          freestyleHook: freestyle,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Upload failed");
        return;
      }

      toast.success("Video submitted for review!");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setLinkUrl("");
      setLinkFileName("");
      setHookSelection(NO_HOOK_ID);
      setFreestyleHook("");
      setProgress(0);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
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
            Upload the video file directly, or paste a cloud link if you
            prefer. Your manager reviews and gives feedback in-app.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
            mode === "file"
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Upload className="mr-1 inline h-3 w-3" />
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setMode("link")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
            mode === "link"
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <LinkIcon className="mr-1 inline h-3 w-3" />
          Paste link
        </button>
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

        {mode === "file" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-slate-700">
              Video file
            </Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*,application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-[11px] text-slate-500">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                Filename
              </Label>
              <Input
                placeholder="my-video.mp4"
                value={linkFileName}
                onChange={(e) => setLinkFileName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                Cloud link
              </Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {!isOnboarding && (
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

      {loading && progress > 0 && progress < 100 && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Uploading… {progress}%
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          className="bg-slate-900 text-white hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? (
            progress > 0 && progress < 100 ? (
              `Uploading ${progress}%…`
            ) : (
              "Submitting..."
            )
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
