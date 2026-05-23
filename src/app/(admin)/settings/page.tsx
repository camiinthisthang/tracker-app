"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BRAND_NAME } from "@/lib/brand";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [schedulingUrl, setSchedulingUrl] = useState("");
  const [creatorWelcomeTemplate, setCreatorWelcomeTemplate] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setTeamName(data.team.name);
        if (data.settings) {
          setTimezone(data.settings.timezone);
          setSchedulingUrl(data.settings.schedulingUrl || "");
          setCreatorWelcomeTemplate(data.settings.creatorWelcomeTemplate || "");
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        teamName,
        timezone,
        schedulingUrl,
        creatorWelcomeTemplate,
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" description="Team settings and preferences" />
        <div className="animate-pulse space-y-4">
          <div className="h-40 rounded-xl bg-slate-100" />
          <div className="h-60 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Team settings and preferences" />

      <div className="space-y-6">
        {/* Team Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-800">Team</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Team name
              </Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Timezone
              </Label>
              <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Interview scheduling link
            </Label>
            <p className="text-xs text-slate-400">
              Your Cal.com / Calendly URL — used in the interview-invite email
              and as the {"{{schedulingUrl}}"} token in the welcome message
              below. E.g.{" "}
              <span className="font-mono">https://cal.com/yourname/creator-interview</span>
            </p>
            <Input
              type="url"
              placeholder="https://cal.com/yourname/creator-interview"
              value={schedulingUrl}
              onChange={(e) => setSchedulingUrl(e.target.value)}
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Creator welcome message (pinned at top of /creator-tasks)
            </Label>
            <p className="text-xs text-slate-400">
              Shown to every newly approved creator the moment they log in.
              Use{" "}
              <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">
                {"{{schedulingUrl}}"}
              </span>{" "}
              as a token — it&apos;ll be replaced with your scheduling link
              above when the message is created.
            </p>
            <Textarea
              rows={10}
              placeholder={`Welcome to ${BRAND_NAME} — you're on the roster...`}
              value={creatorWelcomeTemplate}
              onChange={(e) => setCreatorWelcomeTemplate(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            className="bg-slate-800 text-white hover:bg-slate-700"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
