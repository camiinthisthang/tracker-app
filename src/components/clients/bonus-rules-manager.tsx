"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface BonusRuleRow {
  id: string;
  trigger: "VIEW_THRESHOLD" | "VIRAL_COUNT";
  threshold: number;
  amountUsd: string;
  label: string;
  isActive: boolean;
}

const TRIGGER_LABEL: Record<BonusRuleRow["trigger"], string> = {
  VIEW_THRESHOLD: "views on a single post",
  VIRAL_COUNT: "viral videos this month",
};

export function BonusRulesManager({
  teamId,
  rules,
}: {
  teamId: string;
  rules: BonusRuleRow[];
}) {
  const router = useRouter();
  const [trigger, setTrigger] =
    useState<BonusRuleRow["trigger"]>("VIEW_THRESHOLD");
  const [threshold, setThreshold] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!threshold || !amount || !label.trim()) {
      toast.error("Fill threshold, amount, and label");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/bonus-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          trigger,
          threshold: Number(threshold),
          amountUsd: Number(amount),
          label,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add rule");
        return;
      }
      setThreshold("");
      setAmount("");
      setLabel("");
      toast.success("Bonus rule added");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/bonus-rules/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Rule removed");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Bonus rules</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Creators see progress toward each active rule on their home screen.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-2 border-b border-slate-100 px-5 py-4 sm:grid-cols-5"
      >
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs font-medium text-slate-700">Trigger</Label>
          <Select
            value={trigger}
            onValueChange={(v) =>
              v && setTrigger(v as BonusRuleRow["trigger"])
            }
          >
            <SelectTrigger>
              <SelectValue>{TRIGGER_LABEL[trigger]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEW_THRESHOLD">
                {TRIGGER_LABEL.VIEW_THRESHOLD}
              </SelectItem>
              <SelectItem value="VIRAL_COUNT">
                {TRIGGER_LABEL.VIRAL_COUNT}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">
            Threshold
          </Label>
          <Input
            type="number"
            min={1}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={trigger === "VIEW_THRESHOLD" ? "100000" : "5"}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">USD</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="200"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">Label</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Viral bonus"
          />
        </div>
        <div className="sm:col-span-5 flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add rule
          </Button>
        </div>
      </form>

      {rules.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">
          No bonus rules yet — add one to show creators what&apos;s achievable
          this month.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{r.label}</p>
                <p className="text-xs text-slate-500">
                  Hit {r.threshold.toLocaleString()} {TRIGGER_LABEL[r.trigger]}{" "}
                  →{" "}
                  <span className="font-medium text-emerald-600">
                    ${Number(r.amountUsd).toLocaleString()}
                  </span>
                </p>
              </div>
              {!r.isActive && (
                <Badge className="bg-slate-100 text-slate-500 hover:opacity-90">
                  archived
                </Badge>
              )}
              <Button
                variant="ghost"
                onClick={() => handleDelete(r.id)}
                aria-label="Delete rule"
              >
                <Trash2 className="h-4 w-4 text-slate-400" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
