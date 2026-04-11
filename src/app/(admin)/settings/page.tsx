"use client";

import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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

interface ApiKeyFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  isConfigured: boolean;
}

function ApiKeyField({
  label,
  placeholder,
  value,
  onChange,
  isConfigured,
}: ApiKeyFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium text-slate-700">{label}</Label>
        {isConfigured && !value && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Configured
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={visible ? "text" : "password"}
            placeholder={isConfigured && !value ? "••••••••••••" : placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={() => setVisible(!visible)}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");

  const [tiktokApiKey, setTiktokApiKey] = useState("");
  const [instagramToken, setInstagramToken] = useState("");
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [facebookToken, setFacebookToken] = useState("");

  const [hasTiktok, setHasTiktok] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [hasYoutube, setHasYoutube] = useState(false);
  const [hasFacebook, setHasFacebook] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setTeamName(data.team.name);
        if (data.settings) {
          setTimezone(data.settings.timezone);
          setHasTiktok(data.settings.hasTiktokKey);
          setHasInstagram(data.settings.hasInstagramToken);
          setHasYoutube(data.settings.hasYoutubeKey);
          setHasFacebook(data.settings.hasFacebookToken);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, string> = { teamName, timezone };
      if (tiktokApiKey) body.tiktokApiKey = tiktokApiKey;
      if (instagramToken) body.instagramToken = instagramToken;
      if (youtubeApiKey) body.youtubeApiKey = youtubeApiKey;
      if (facebookToken) body.facebookToken = facebookToken;

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Settings saved");
        // Update configured status
        if (tiktokApiKey) setHasTiktok(true);
        if (instagramToken) setHasInstagram(true);
        if (youtubeApiKey) setHasYoutube(true);
        if (facebookToken) setHasFacebook(true);
        // Clear inputs after save
        setTiktokApiKey("");
        setInstagramToken("");
        setYoutubeApiKey("");
        setFacebookToken("");
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
        </div>

        {/* Social API Credentials */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-800">
            Social Platform API Keys
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Configure API credentials to sync posts from social platforms.
            Keys are encrypted and stored securely.
          </p>

          <div className="mt-4 space-y-4">
            <ApiKeyField
              label="TikTok Client Key"
              placeholder="Enter your TikTok Research API client key"
              value={tiktokApiKey}
              onChange={setTiktokApiKey}
              isConfigured={hasTiktok}
            />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">TikTok Client Secret</Label>
              <p className="text-xs text-slate-400">
                Get your credentials at{" "}
                <a href="https://developers.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                  developers.tiktok.com
                </a>
                {" "}→ Research API (requires approval)
              </p>
            </div>
            <ApiKeyField
              label="Instagram Access Token"
              placeholder="Enter your long-lived Instagram access token"
              value={instagramToken}
              onChange={setInstagramToken}
              isConfigured={hasInstagram}
            />
            <p className="text-xs text-slate-400">
              Requires a Meta Business app with Instagram Graph API.{" "}
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                developers.facebook.com
              </a>
            </p>
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
