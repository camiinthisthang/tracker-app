"use client";

import { useState } from "react";
import { Calendar, Mail, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface InterviewInviteButtonProps {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  teamName: string;
  schedulingUrl?: string | null;
}

export function InterviewInviteButton({
  applicationId,
  applicantName,
  applicantEmail,
  teamName,
  schedulingUrl,
}: InterviewInviteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // The scheduling link we'll embed (fallback if team has no schedulingUrl set)
  const bookingUrl =
    schedulingUrl && schedulingUrl.trim().length > 0
      ? schedulingUrl
      : "https://cal.com/yourname/creator-interview";

  const firstName = applicantName.split(" ")[0] || applicantName;
  const defaultSubject = `${teamName} — let's chat about the creator role`;
  const defaultBody = `Hey ${firstName},

Thanks for applying to ${teamName}! We reviewed your videos and would love to jump on a quick 15-minute call to get to know you.

Pick a time that works here: ${bookingUrl}

Looking forward to it,
${teamName} team`;

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  async function handleSend() {
    setLoading(true);
    try {
      // Update the application status to REVIEWING
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWING" }),
      });

      if (!res.ok) {
        toast.error("Couldn't update application status");
        setLoading(false);
        return;
      }

      // Open the mail client
      const mailtoUrl = `mailto:${encodeURIComponent(
        applicantEmail
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, "_blank");

      toast.success(`${firstName} moved to Reviewing — your email is ready to send`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const hasSchedulingUrl = !!schedulingUrl && schedulingUrl.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Invite to interview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite {firstName} to interview</DialogTitle>
          <DialogDescription>
            Review the email below. Clicking Send will open your mail client
            with this pre-filled and mark the application as Reviewing.
          </DialogDescription>
        </DialogHeader>

        {!hasSchedulingUrl && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <strong>No scheduling link set.</strong> The email below uses a
            placeholder URL. Go to{" "}
            <a href="/settings" className="underline">
              Settings
            </a>{" "}
            and paste your Cal.com URL so applicants can book directly.
          </div>
        )}

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-slate-500">To</Label>
            <Input value={applicantEmail} readOnly className="bg-slate-50" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-slate-500">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-slate-500">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <p className="font-semibold text-slate-700">Scheduling link used</p>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              {bookingUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={handleSend}
            disabled={loading}
          >
            <Mail className="mr-2 h-4 w-4" />
            {loading ? "Sending..." : "Open email & mark reviewing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
