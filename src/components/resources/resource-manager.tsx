"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export interface ResourceRow {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
}

export function ResourceManager({
  initial,
}: {
  initial: ResourceRow[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ResourceRow>>({});

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          url: url.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add resource");
        return;
      }
      setTitle("");
      setUrl("");
      setDescription("");
      setCategory("");
      toast.success("Resource added");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(id: string) {
    const res = await fetch(`/api/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      toast.error("Failed to save");
      return;
    }
    setEditingId(null);
    setEditForm({});
    toast.success("Saved");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/resources/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Resource removed");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          Creator resources
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Links your creators see on the Resources tab — Playbook, gallery,
          brand guidelines, Loom walkthroughs. Paste any URL (Notion, Drive,
          Canva, YouTube).
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-2"
      >
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs font-medium text-slate-700">Title</Label>
          <Input
            placeholder="Creator Playbook"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs font-medium text-slate-700">URL</Label>
          <Input
            placeholder="https://www.notion.so/your-playbook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">
            Category (optional)
          </Label>
          <Input
            placeholder="Playbook, Inspiration, Brand"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-700">
            Description (optional)
          </Label>
          <Textarea
            placeholder="Short one-liner shown on the card"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            disabled={creating}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add resource
          </Button>
        </div>
      </form>

      {initial.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">
          No resources yet — add at least one so creators have somewhere to
          click on their Resources tab.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {initial.map((r) => {
            const isEditing = editingId === r.id;
            return (
              <li key={r.id} className="px-5 py-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editForm.title ?? r.title}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, title: e.target.value }))
                      }
                      placeholder="Title"
                    />
                    <Input
                      value={editForm.url ?? r.url}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, url: e.target.value }))
                      }
                      placeholder="URL"
                    />
                    <Input
                      value={editForm.category ?? r.category ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          category: e.target.value,
                        }))
                      }
                      placeholder="Category (optional)"
                    />
                    <Textarea
                      value={editForm.description ?? r.description ?? ""}
                      rows={2}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Description (optional)"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm({});
                        }}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSave(r.id)}
                        className="bg-slate-900 text-white hover:bg-slate-800"
                      >
                        <Save className="mr-1 h-3.5 w-3.5" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-800 hover:text-blue-600"
                        >
                          {r.title}
                        </a>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                        {r.category && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {r.category}
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.description}
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">
                        {r.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Edit"
                        onClick={() => {
                          setEditingId(r.id);
                          setEditForm({});
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
