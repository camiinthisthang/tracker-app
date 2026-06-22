"use client";

import { useState } from "react";
import { Plus, X, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ReportConfigProps {
  campaignId: string;
  config: {
    id: string;
    isEnabled: boolean;
    recipients: string[];
    publicSlug: string | null;
  } | null;
}

export function ReportConfig({ campaignId, config }: ReportConfigProps) {
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false);
  const [recipients, setRecipients] = useState<string[]>(
    config?.recipients ?? []
  );
  const [emailInput, setEmailInput] = useState("");
  const [publicSlug, setPublicSlug] = useState(config?.publicSlug ?? null);
  const [saving, setSaving] = useState(false);

  function addRecipient() {
    const email = emailInput.trim();
    if (email && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setEmailInput("");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          isEnabled,
          recipients,
        }),
      });

      if (res.ok) {
        toast.success("Report settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function generatePublicLink() {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          generatePublicLink: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPublicSlug(data.publicSlug);
        toast.success("Public link generated");
      }
    } catch {
      toast.error("Failed to generate link");
    }
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Weekly Reports
            </h3>
            <p className="text-xs text-slate-400">
              Send automated reports every Monday morning
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </div>

      {/* Recipients */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">Recipients</h3>
        <p className="mb-3 text-xs text-slate-400">
          Email addresses that will receive the weekly report
        </p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="team@company.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
          />
          <Button variant="outline" onClick={addRecipient}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        {recipients.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              >
                {email}
                <button
                  onClick={() =>
                    setRecipients(recipients.filter((e) => e !== email))
                  }
                >
                  <X className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Public Link */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Public Overview Link
        </h3>
        <p className="mb-3 text-xs text-slate-400">
          Share a live read-only view of campaign performance
        </p>
        {publicSlug ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <Link2 className="h-4 w-4 text-slate-400" />
            <span className="flex-1 text-sm text-slate-600">
              {typeof window !== "undefined"
                ? `${window.location.origin}/reports/${publicSlug}`
                : `/reports/${publicSlug}`}
            </span>
            <a
              href={`/reports/${publicSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--brand-blue)] hover:opacity-80"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <Button variant="outline" onClick={generatePublicLink}>
            <Link2 className="mr-2 h-4 w-4" />
            Generate Public Link
          </Button>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          className="bg-slate-800 text-white hover:bg-slate-700"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
