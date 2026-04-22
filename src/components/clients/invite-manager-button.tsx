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
  variant = "client",
}: {
  teamId: string;
  teamName: string;
  /**
   * "client" = inviting a client-side manager (ADMIN of a single client
   * workspace like Poncho). "agency" = inviting a fellow agency admin
   * (ADMIN of the Tapmore team — cross-client visibility).
   */
  variant?: "client" | "agency";
}) {
  const isAgency = variant === "agency";
  const buttonLabel = isAgency ? "Invite agency admin" : "Invite manager";
  const dialogTitle = isAgency
    ? `Invite an agency admin to ${teamName}`
    : `Invite a manager to ${teamName}`;
  const dialogDescription = isAgency
    ? "They'll get ADMIN access to every client workspace you operate — same visibility as you, minus super-admin-only actions like creating new clients or deleting creators."
    : `They'll get ADMIN access to this client workspace only — they won't see other clients or the master admin view.`;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
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
        body: JSON.stringify({ email: email.trim(), variant }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Could not create invite", {
          description: body?.suggestion,
        });
        setLoading(false);
        return;
      }
      const data = await res.json();
      setInviteUrl(data.url);
      setEmailSent(Boolean(data.emailSent));
      setEmailError(data.emailError ?? null);
      if (data.emailSent) {
        toast.success(`Invite emailed to ${email.trim()}`);
      } else {
        toast.warning(
          data.emailError
            ? `Email delivery failed: ${data.emailError}. Copy the link below.`
            : "Invite link ready — copy it to the manager",
        );
      }
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
      setEmailSent(null);
      setEmailError(null);
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
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
            {emailSent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <strong>Invite emailed to {email}.</strong> They have 14 days
                to accept. The link is also below in case you want to share
                it another way.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Invite created, but email didn&apos;t send.</strong>
                {emailError ? ` (${emailError})` : ""} Copy the link below and
                send it manually.
              </div>
            )}
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
              <Button
                onClick={() => handleClose(false)}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                Done
              </Button>
              {!emailSent && (
                <Button variant="outline" onClick={handleMailto}>
                  <Mail className="mr-2 h-4 w-4" />
                  Open in mail app
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
