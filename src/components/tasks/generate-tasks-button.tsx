"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface GenerateTasksButtonProps {
  campaignId: string;
}

export function GenerateTasksButton({ campaignId }: GenerateTasksButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-tasks`, {
        method: "POST",
      });

      if (!res.ok) {
        toast.error("Failed to generate tasks");
        return;
      }

      const data = await res.json();
      toast.success(`Generated ${data.created} new tasks`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={loading}
    >
      <Wand2 className="mr-2 h-4 w-4" />
      {loading ? "Generating..." : "Generate Tasks"}
    </Button>
  );
}
