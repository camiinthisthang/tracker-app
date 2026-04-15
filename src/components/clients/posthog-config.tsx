"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function PostHogConfig({
  teamId,
  hasApiKey,
  projectId: initialProjectId,
  host: initialHost,
}: {
  teamId: string;
  hasApiKey: boolean;
  projectId: string | null;
  host: string | null;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [host, setHost] = useState(initialHost ?? "");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        teamId,
        posthogProjectId: projectId,
        posthogHost: host,
      };
      if (apiKey.trim().length > 0) body.posthogApiKey = apiKey;
      const res = await fetch("/api/posthog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("Save failed");
        return;
      }
      toast.success("PostHog config saved");
      setApiKey("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, action: "test" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) toast.success("PostHog connection OK");
      else toast.error(data.error || "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, action: "sync" }),
      });
      const data = (await res.json()) as {
        synced?: boolean;
        totalRows?: number;
        error?: string;
      };
      if (data.synced) {
        toast.success(`Synced ${data.totalRows ?? 0} attribution rows`);
        router.refresh();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          PostHog attribution
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Paste this client&apos;s PostHog API key + project ID. The daily
          cron pulls signups tagged with <code>referral_creator_id</code>.
        </p>
      </div>
      <form onSubmit={handleSave} className="grid gap-3 px-5 py-4">
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium text-slate-700">API key</Label>
          <Input
            type="password"
            placeholder={
              hasApiKey ? "•••••• (saved — leave blank to keep)" : "phx_…"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Project ID
            </Label>
            <Input
              placeholder="12345"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">
              Host (optional)
            </Label>
            <Input
              placeholder="https://us.i.posthog.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={testing || !hasApiKey}
          >
            Test connection
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSyncNow}
            disabled={syncing || !hasApiKey}
          >
            Sync now
          </Button>
        </div>
      </form>
    </section>
  );
}
