"use client";

import { useState } from "react";
import { Copy, Mail, CheckCircle, Send } from "lucide-react";
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
import { toast } from "sonner";

interface InviteCreatorButtonProps {
  creatorId: string;
  creatorName: string;
  creatorEmail: string | null;
  hasAccount: boolean;
}

export function InviteCreatorButton({
  creatorId,
  creatorName,
  creatorEmail,
  hasAccount,
}: InviteCreatorButtonProps) {
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  async function callInviteApi(sendEmail: boolean) {
    const res = await fetch(`/api/creators/${creatorId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function generateLinkOnly() {
    setLoading(true);
    try {
      const data = await callInviteApi(false);
      if (!data) {
        toast.error("Failed to generate invite");
        return;
      }
      setInviteUrl(`${window.location.origin}${data.inviteUrl}`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function sendEmailNow() {
    setSendingEmail(true);
    try {
      const data = await callInviteApi(true);
      if (!data) {
        toast.error("Failed to send invite");
        return;
      }
      if (!inviteUrl) {
        setInviteUrl(`${window.location.origin}${data.inviteUrl}`);
      }
      setEmailSent(Boolean(data.emailSent));
      setEmailError(data.emailError ?? null);
      if (data.emailSent) {
        toast.success(`Invite emailed to ${creatorEmail}`);
      } else {
        toast.error(
          data.emailError
            ? `Email failed: ${data.emailError}`
            : "Email failed — copy the link below."
        );
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSendingEmail(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  }

  if (hasAccount) {
    return (
      <Button variant="outline" size="sm" disabled>
        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
        Account created
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !inviteUrl) generateLinkOnly();
        if (!o) {
          setEmailSent(null);
          setEmailError(null);
          setCopied(false);
        }
      }}
    >
      <DialogTrigger>
        <Button variant="outline" size="sm" type="button">
          <Mail className="mr-2 h-4 w-4" />
          Invite creator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {creatorName}</DialogTitle>
          <DialogDescription>
            {creatorEmail
              ? `Send an email invite to ${creatorEmail} or copy the link below.`
              : "No email on file — copy the link and send it manually."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Generating link...</p>
          ) : (
            <div className="flex gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {emailSent === true && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Invite email sent successfully.
            </div>
          )}
          {emailSent === false && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Email send failed{emailError ? `: ${emailError}` : ""}. Copy the
              link above instead.
            </div>
          )}

          <p className="text-xs text-slate-400">
            The link becomes invalid once the creator signs up.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {creatorEmail && (
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={sendEmailNow}
              disabled={sendingEmail || loading}
            >
              {sendingEmail ? (
                <>
                  <Mail className="mr-2 h-4 w-4 animate-pulse" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send email
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
