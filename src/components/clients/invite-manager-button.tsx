"use client";

import { useState } from "react";
import { Copy, Mail, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function InviteManagerButton({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Could not create invite", {
          description: body?.suggestion,
        });
        setLoading(false);
        return;
      }
      const { url } = await res.json();
      setInviteUrl(url);
      toast.success("Invite link ready — copy it to the manager");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleMailto() {
    const subject = `You're invited to manage ${teamName} on Viewtrackr`;
    const body = `Hey,\n\nI've set up a Viewtrackr workspace for ${teamName} so you can see everything we're running for you — creators, campaigns, posts, analytics. Accept the invite here:\n\n${inviteUrl}\n\nThis link expires in 14 days.\n\n— Cami`;
    window.open(
      `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`,
      "_blank"
    );
  }

  function handleClose(next: boolean) {
    if (!next) {
      setEmail("");
      setInviteUrl("");
      setCopied(false);
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger>
        <Button
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite manager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a manager to {teamName}</DialogTitle>
          <DialogDescription>
            They&apos;ll get ADMIN access to this client workspace only — they
            won&apos;t see other clients or the master admin view.
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-slate-500">Email</Label>
              <Input
                type="email"
                placeholder="manager@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <strong>Invite created.</strong> Share this link with {email}. It
              expires in 14 days.
            </div>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {!inviteUrl ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {loading ? "Creating..." : "Create invite"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Done
              </Button>
              <Button
                onClick={handleMailto}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                <Mail className="mr-2 h-4 w-4" />
                Send via email
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
