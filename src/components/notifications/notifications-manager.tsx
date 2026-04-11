"use client";

import { useState } from "react";
import { Plus, Trash2, Zap, Clock, Calendar, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface NotificationRule {
  id: string;
  type: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  webhookUrl: string;
  thresholdMetric: string | null;
  thresholdValue: number | null;
}

interface NotificationsManagerProps {
  campaignId: string;
  rules: NotificationRule[];
}

const THRESHOLD_PRESETS = [
  { label: "10K views", value: 10000 },
  { label: "50K views", value: 50000 },
  { label: "100K views", value: 100000 },
  { label: "250K views", value: 250000 },
  { label: "500K views", value: 500000 },
  { label: "1M views", value: 1000000 },
  { label: "2M views", value: 2000000 },
  { label: "3M views", value: 3000000 },
  { label: "4M views", value: 4000000 },
  { label: "5M views", value: 5000000 },
  { label: "10M views", value: 10000000 },
];

const RULE_TYPES = [
  {
    type: "TOP_POSTS_WEEKLY",
    label: "Top Posts (Weekly)",
    icon: Calendar,
    description: "Send top performing posts every week",
  },
  {
    type: "TOP_POSTS_DAILY",
    label: "Top Posts (Daily)",
    icon: Clock,
    description: "Send top performing posts every day",
  },
  {
    type: "THRESHOLD_HIT",
    label: "Threshold Hit (On Sync)",
    icon: Zap,
    description: "Send notifications when any post reaches a view count",
  },
];

export function NotificationsManager({
  campaignId,
  rules: initialRules,
}: NotificationsManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);

  async function addRule(type: string) {
    const ruleType = RULE_TYPES.find((r) => r.type === type)!;
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          type,
          name: `${ruleType.label} Rule`,
          description: ruleType.description,
          webhookUrl: "",
          thresholdMetric: type === "THRESHOLD_HIT" ? "views" : null,
          thresholdValue: type === "THRESHOLD_HIT" ? 50000 : null,
        }),
      });

      if (res.ok) {
        const rule = await res.json();
        setRules([...rules, rule]);
        toast.success("Rule added");
      }
    } catch {
      toast.error("Failed to add rule");
    }
  }

  async function deleteRule(ruleId: string) {
    try {
      await fetch(`/api/notifications?ruleId=${ruleId}`, { method: "DELETE" });
      setRules(rules.filter((r) => r.id !== ruleId));
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  }

  async function updateRule(ruleId: string, updates: Partial<NotificationRule>) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, ...updates }),
      });
      setRules(rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
    } catch {
      toast.error("Failed to update rule");
    }
  }

  async function testWebhook(webhookUrl: string) {
    if (!webhookUrl) {
      toast.error("Enter a webhook URL first");
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test",
          message: "Test notification from Tracker",
          timestamp: new Date().toISOString(),
        }),
      });
      toast.success("Test webhook sent!");
    } catch {
      toast.error("Webhook test failed — check the URL");
    }
  }

  async function handleSave() {
    setSaving(true);
    toast.success("Settings saved");
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {RULE_TYPES.map((ruleType) => {
        const typeRules = rules.filter((r) => r.type === ruleType.type);
        const Icon = ruleType.icon;

        return (
          <div
            key={ruleType.type}
            className="rounded-xl border border-slate-200 bg-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">
                  {ruleType.label}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addRule(ruleType.type)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Rule
              </Button>
            </div>

            {/* Rules */}
            <div className="p-5">
              {typeRules.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  No {ruleType.label.toLowerCase()} rules configured. Click
                  &quot;Add Rule&quot; to create one.
                </p>
              ) : (
                <div className="space-y-4">
                  {typeRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-lg border border-slate-100 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {rule.name}
                          </p>
                          {rule.description && (
                            <p className="text-xs text-slate-400">
                              {rule.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.isEnabled}
                            onCheckedChange={(v) =>
                              updateRule(rule.id, { isEnabled: v })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Threshold picker for THRESHOLD_HIT */}
                      {rule.type === "THRESHOLD_HIT" && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs text-slate-500">
                            Send notifications when any post reaches:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {THRESHOLD_PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                onClick={() =>
                                  updateRule(rule.id, {
                                    thresholdValue: preset.value,
                                  })
                                }
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                                  rule.thresholdValue === preset.value
                                    ? "bg-slate-800 text-white"
                                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              placeholder="Custom threshold"
                              className="w-40"
                              type="number"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = parseInt(
                                    (e.target as HTMLInputElement).value
                                  );
                                  if (val > 0) {
                                    updateRule(rule.id, {
                                      thresholdValue: val,
                                    });
                                  }
                                }
                              }}
                            />
                            <Button variant="outline" size="sm">
                              <Plus className="mr-1 h-3 w-3" />
                              Add
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Webhook URL */}
                      <div className="mt-3">
                        <p className="mb-1 text-xs text-slate-500">
                          Webhook URL
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="https://hooks.slack.com/services/..."
                            value={rule.webhookUrl}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                webhookUrl: e.target.value,
                              })
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testWebhook(rule.webhookUrl)}
                          >
                            <Send className="mr-1 h-3.5 w-3.5" />
                            Test
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          className="bg-slate-800 text-white hover:bg-slate-700"
          onClick={handleSave}
          disabled={saving}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}
