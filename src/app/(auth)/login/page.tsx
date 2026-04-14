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
import { BarChart3 } from "lucide-react";
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
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500">
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-xl font-semibold text-slate-800">
          Welcome back
        </CardTitle>
        <CardDescription className="text-slate-500">
          Sign in to your account
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
            className="w-full bg-slate-800 text-white hover:bg-slate-700"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-blue-500 hover:text-blue-600"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
