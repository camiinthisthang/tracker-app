"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: (slug || slugify(name)).trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Could not create client");
        setLoading(false);
        return;
      }
      const team = await res.json();
      toast.success(`${team.name} created`);
      router.push(`/clients/${team.id}`);
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium text-slate-700">
            Client name
          </Label>
          <Input
            id="name"
            placeholder="Acme Fintech"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
          <p className="text-xs text-slate-400">
            Shown in the sidebar and on reports sent to this client.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug" className="text-sm font-medium text-slate-700">
            URL slug
          </Label>
          <Input
            id="slug"
            placeholder="acme-fintech"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
          />
          <p className="text-xs text-slate-400">
            Used for public report links. Must be unique.
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/clients")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-slate-900 text-white hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create client"}
        </Button>
      </div>
    </form>
  );
}
