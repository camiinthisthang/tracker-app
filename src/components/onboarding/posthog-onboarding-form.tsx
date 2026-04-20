"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export function PostHogOnboardingForm({
  initialProjectId,
  initialHost,
}: {
  initialProjectId: string;
  initialHost: string;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId);
  const [host, setHost] = useState(initialHost);
  const [testResult, setTestResult] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const canSubmit = apiKey.trim().length > 0 && projectId.trim().length > 0;

  async function handleTest() {
    if (!canSubmit) {
      toast.error("Enter an API key and project ID first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/posthog/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posthogApiKey: apiKey.trim(),
          posthogProjectId: projectId.trim(),
          posthogHost: host.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true });
      } else {
        setTestResult({ ok: false, error: data.error ?? "Connection failed" });
      }
    } catch {
      setTestResult({ ok: false, error: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/posthog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posthogApiKey: apiKey.trim(),
          posthogProjectId: projectId.trim(),
          posthogHost: host.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to save PostHog config");
        setSaving(false);
        return;
      }
      toast.success("PostHog connected");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      await fetch("/api/posthog/skip", { method: "POST" });
    } finally {
      router.push("/dashboard");
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">
          PostHog API key (personal or project)
        </Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setTestResult(null);
          }}
          placeholder="phx_... or phc_..."
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">Project ID</Label>
        <Input
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setTestResult(null);
          }}
          placeholder="12345"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">
          PostHog host (optional)
        </Label>
        <Input
          value={host}
          onChange={(e) => {
            setHost(e.target.value);
            setTestResult(null);
          }}
          placeholder={DEFAULT_POSTHOG_HOST}
        />
        <p className="text-[11px] text-slate-400">
          Defaults to {DEFAULT_POSTHOG_HOST}. Use your self-hosted URL if you
          don&apos;t use PostHog Cloud US.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={!canSubmit || testing}
        >
          {testing ? "Testing..." : "Test connection"}
        </Button>
        {testResult?.ok === true && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reached PostHog successfully
          </span>
        )}
        {testResult?.ok === false && (
          <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {testResult.error}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleSkip}
          disabled={skipping}
          className="text-slate-500"
        >
          {skipping ? "Skipping..." : "Skip for now"}
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || saving}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          {saving ? "Saving..." : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
