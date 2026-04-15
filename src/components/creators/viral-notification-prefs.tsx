"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props {
  initial: {
    viralEmail: boolean;
    viralSms: boolean;
    phoneNumber: string | null;
    threshold: number | null;
  };
}

export function ViralNotificationPrefs({ initial }: Props) {
  const [email, setEmail] = useState(initial.viralEmail);
  const [sms, setSms] = useState(initial.viralSms);
  const [phone, setPhone] = useState(initial.phoneNumber ?? "");
  const [threshold, setThreshold] = useState(
    initial.threshold ? String(initial.threshold) : ""
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viralEmail: email,
          viralSms: sms,
          phoneNumber: phone,
          threshold: threshold ? Number(threshold) : null,
        }),
      });
      if (!res.ok) {
        toast.error("Save failed");
        return;
      }
      toast.success("Preferences saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Viral video alerts
          </h3>
          <p className="text-xs text-slate-400">
            Get notified when one of your posts crosses a view threshold in
            24 hours, so you can capitalize on momentum.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Email me</p>
            <p className="text-xs text-slate-500">
              Sent to the email on your creator profile.
            </p>
          </div>
          <Switch checked={email} onCheckedChange={setEmail} />
        </div>

        <div className="rounded-lg border border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Text me</p>
              <p className="text-xs text-slate-500">
                SMS via our provider. Requires a valid phone number.
              </p>
            </div>
            <Switch checked={sms} onCheckedChange={setSms} />
          </div>
          {sms && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">
                Phone number
              </Label>
              <Input
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700">
            Threshold (views in 24h)
          </Label>
          <Input
            type="number"
            min={1000}
            step={1000}
            placeholder="50000"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <p className="text-[11px] text-slate-400">
            Leave blank to use the default (50,000).
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            Save preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
