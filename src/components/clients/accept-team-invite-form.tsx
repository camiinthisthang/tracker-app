"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export function AcceptTeamInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/invite/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Could not accept invite");
        setLoading(false);
        return;
      }

      // If the account already had a password, the new one was NOT saved.
      // Send them to /login so they can use their existing creds.
      if (data?.accountAlreadyExisted) {
        toast.success(
          "You're invited! Sign in with your existing password to continue.",
          { duration: 6000 }
        );
        router.push(`/login?email=${encodeURIComponent(email)}`);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Account created but sign-in failed. Try logging in.");
        router.push("/login");
        return;
      }
      router.push(data?.needsPostHogOnboarding ? "/onboarding/posthog" : "/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <GoogleSignInButton
        label={`Accept with Google (${email})`}
        callbackUrl="/dashboard"
      />
      <p className="text-center text-[11px] text-slate-400">
        Use the Google account that matches{" "}
        <span className="font-medium text-slate-600">{email}</span> — we&apos;ll
        attach you to the team automatically.
      </p>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          or set a password
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Email</Label>
          <Input value={email} readOnly className="bg-slate-50" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Your name</Label>
          <Input
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Choose a password</Label>
          <Input
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 text-white hover:bg-slate-800"
        >
          {loading ? "Creating account..." : "Accept invite & sign in"}
        </Button>
      </form>
    </div>
  );
}
