"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface Team {
  id: string;
  name: string;
}

interface Props {
  canPickClient: boolean;
  teams: Team[];
  defaultTeamId: string;
}

const TIER_OPTIONS = [
  { value: "TRAINING", label: "Training" },
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
] as const;

export function AddCreatorButton({ canPickClient, teams, defaultTeamId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
    email: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [tier, setTier] = useState<(typeof TIER_OPTIONS)[number]["value"]>(
    "TRAINING"
  );

  function reset() {
    setName("");
    setEmail("");
    setTeamId(defaultTeamId);
    setTier("TRAINING");
    setResult(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (canPickClient && !teamId) {
      toast.error("Pick a client");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          teamId: canPickClient ? teamId : undefined,
          tier,
          isActive: true,
          sendInvite: true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error || "Could not create creator";
        const description = data?.suggestion as string | undefined;
        const conflict = data?.conflict as
          | { table: "user" | "creator" | "application"; existingId: string }
          | undefined;
        const action =
          conflict?.table === "creator"
            ? {
                label: "View creator",
                onClick: () =>
                  router.push(`/creators/${conflict.existingId}`),
              }
            : conflict?.table === "application"
            ? {
                label: "Open application",
                onClick: () => router.push(`/applications`),
              }
            : undefined;
        toast.error(message, { description, action });
        setSubmitting(false);
        return;
      }

      const origin = window.location.origin;
      setResult({
        inviteUrl: `${origin}${data.inviteUrl}`,
        emailSent: Boolean(data.inviteEmailSent),
        email: email.trim() || null,
      });
      toast.success("Creator created");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.inviteUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger>
        <Button className="bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="mr-2 h-4 w-4" />
          New creator
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!result ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add a new creator</DialogTitle>
              <DialogDescription>
                They&apos;ll get an email invite to set their password and
                complete onboarding.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-xs text-slate-600">Name</Label>
                <Input
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-slate-600">Email</Label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">
                  Invite link will be emailed here. Leave blank to just copy
                  the link yourself.
                </p>
              </div>
              {canPickClient && (
                <div className="grid gap-1.5">
                  <Label className="text-xs text-slate-600">Client</Label>
                  <Select
                    value={teamId}
                    onValueChange={(v) => v && setTeamId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a client">
                        {teams.find((t) => t.id === teamId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label className="text-xs text-slate-600">Tier</Label>
                <Select
                  value={tier}
                  onValueChange={(v) =>
                    v && setTier(v as (typeof TIER_OPTIONS)[number]["value"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {TIER_OPTIONS.find((t) => t.value === tier)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TIER_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {submitting ? "Creating..." : "Create & send invite"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>
            <DialogHeader>
              <DialogTitle>Creator added</DialogTitle>
              <DialogDescription>
                {result.emailSent && result.email
                  ? `Invite emailed to ${result.email}.`
                  : result.email
                  ? `Email send failed — copy the link below and send it manually.`
                  : `No email set — copy the invite link below and send it manually.`}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={result.inviteUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={copyLink}>
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {result.emailSent && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
                  <Mail className="h-3.5 w-3.5" />
                  Invite email sent successfully.
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
