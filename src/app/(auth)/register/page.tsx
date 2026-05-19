"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, teamName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but sign in failed. Please try logging in.");
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-wider text-foreground/55">
          create account
        </p>
        <CardTitle className="text-3xl font-bold tracking-tight lowercase">
          get started<span className="text-[var(--brand-blue)]">.</span>
        </CardTitle>
        <CardDescription className="font-mono text-xs text-foreground/60">
          your ugc campaign management workspace, in 30 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleSignInButton label="Sign up with Google" />
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            or with email
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="teamName" className="text-sm font-medium text-slate-700">
              Team name
            </Label>
            <Input
              id="teamName"
              placeholder="Acme Inc"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium text-slate-700">
              Your name
            </Label>
            <Input
              id="name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[var(--brand-blue)] font-mono text-sm text-white hover:opacity-90"
            disabled={loading}
          >
            {loading ? "creating account..." : "create account →"}
          </Button>
        </form>
        <p className="mt-4 text-center font-mono text-xs text-foreground/60">
          already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--brand-blue)] hover:underline"
          >
            sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
