"use client";

import { useState } from "react";
import { Copy, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface InviteCreatorButtonProps {
  creatorId: string;
  creatorName: string;
  hasAccount: boolean;
}

export function InviteCreatorButton({
  creatorId,
  creatorName,
  hasAccount,
}: InviteCreatorButtonProps) {
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateInvite() {
    setLoading(true);
    try {
      const res = await fetch(`/api/creators/${creatorId}/invite`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Failed to generate invite");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      setInviteUrl(fullUrl);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
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
        if (o && !inviteUrl) generateInvite();
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
            Share this link with the creator. They&apos;ll set up their account
            and connect their TikTok.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400">Generating link...</p>
          ) : (
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-400">
            The link becomes invalid once the creator signs up.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
