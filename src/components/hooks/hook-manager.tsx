"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface HookRow {
  id: string;
  text: string;
  category: string | null;
  isActive: boolean;
}

export function HookManager({ hooks }: { hooks: HookRow[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, category }),
      });
      if (!res.ok) {
        toast.error("Failed to add hook");
        return;
      }
      setText("");
      setCategory("");
      toast.success("Hook added");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function patchHook(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/hooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error("Failed to update hook");
      return false;
    }
    return true;
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return;
    const ok = await patchHook(id, { text: editText, category: editCategory });
    if (ok) {
      setEditingId(null);
      toast.success("Hook updated");
      router.refresh();
    }
  }

  async function handleToggleArchive(id: string, isActive: boolean) {
    const ok = await patchHook(id, { isActive: !isActive });
    if (ok) {
      toast.success(isActive ? "Hook archived" : "Hook restored");
      router.refresh();
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Manage hooks</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Define the hooks creators can pick from. Archive hooks you&apos;re
          retiring — existing tagged videos keep the reference.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row"
      >
        <Input
          placeholder="New hook text (e.g. 'POV: my first manicure appointment')"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="sm:max-w-[180px]"
        />
        <Button
          type="submit"
          disabled={loading}
          className="bg-slate-900 text-white hover:bg-slate-800"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </form>

      {hooks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-400">
          No hooks yet — add one above so creators can tag their videos.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {hooks.map((h) => {
            const editing = editingId === h.id;
            return (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                {editing ? (
                  <>
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="Category"
                      className="sm:max-w-[180px]"
                    />
                    <Button
                      onClick={() => handleSaveEdit(h.id)}
                      className="bg-blue-500 text-white hover:bg-blue-600"
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          h.isActive
                            ? "text-sm text-slate-800"
                            : "text-sm text-slate-400 line-through"
                        }
                      >
                        {h.text}
                      </p>
                      {h.category && (
                        <Badge className="mt-1 bg-slate-100 text-slate-600 hover:opacity-90">
                          {h.category}
                        </Badge>
                      )}
                    </div>
                    {!h.isActive && (
                      <Badge className="bg-slate-100 text-slate-500 hover:opacity-90">
                        archived
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(h.id);
                        setEditText(h.text);
                        setEditCategory(h.category ?? "");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleToggleArchive(h.id, h.isActive)}
                    >
                      {h.isActive ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <ArchiveRestore className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
