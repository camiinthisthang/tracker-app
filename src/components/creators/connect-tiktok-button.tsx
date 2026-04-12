"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CheckCircle, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ConnectTikTokButtonProps {
  creatorId: string;
  isConnected: boolean;
  tiktokUsername?: string | null;
  connectedAt?: string | null;
}

export function ConnectTikTokButton({
  creatorId,
  isConnected,
  tiktokUsername,
  connectedAt,
}: ConnectTikTokButtonProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("connected") === "tiktok") {
      toast.success("TikTok account connected!");
      // Clean up URL
      window.history.replaceState({}, "", "/profile");
    }
    const error = searchParams.get("error");
    if (error) {
      toast.error(`Connection failed: ${error}`);
      window.history.replaceState({}, "", "/profile");
    }
  }, [searchParams]);

  function handleConnect() {
    window.location.href = `/api/auth/tiktok/connect?creatorId=${creatorId}`;
  }

  if (isConnected) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">
              TikTok Connected
            </p>
            <p className="mt-0.5 text-xs text-green-700">
              @{tiktokUsername}{" "}
              {connectedAt &&
                `· Connected ${new Date(connectedAt).toLocaleDateString()}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            className="border-green-300 text-green-700 hover:bg-green-100"
          >
            Reconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900">
          <Music className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            Connect your TikTok account
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Authorize the app to read your public videos so performance metrics
            appear on your dashboard.
          </p>
          <Button
            className="mt-3 bg-slate-900 text-white hover:bg-slate-800"
            size="sm"
            onClick={handleConnect}
          >
            <Music className="mr-2 h-4 w-4" />
            Connect TikTok
          </Button>
        </div>
      </div>
    </div>
  );
}
