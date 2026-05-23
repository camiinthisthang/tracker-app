"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BRAND_WORDMARK } from "@/lib/brand";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader>
        <p className="font-mono text-xs uppercase tracking-wider text-foreground/55">
          sign in
        </p>
        <CardTitle className="text-3xl font-bold tracking-tight lowercase">
          welcome back<span className="text-[var(--brand-blue)]">.</span>
        </CardTitle>
        <CardDescription className="font-mono text-xs text-foreground/60">
          sign in to your {BRAND_WORDMARK} account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleSignInButton />
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
            <Label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[var(--brand-blue)] font-mono text-sm text-white hover:opacity-90"
            disabled={loading}
          >
            {loading ? "signing in..." : "sign in →"}
          </Button>
        </form>
        <p className="mt-4 text-center font-mono text-xs text-foreground/60">
          don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--brand-blue)] hover:underline"
          >
            create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
