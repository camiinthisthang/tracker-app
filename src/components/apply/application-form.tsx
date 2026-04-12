"use client";

import { useState } from "react";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ApplicationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [about, setAbout] = useState("");
  const [videoUrls, setVideoUrls] = useState<string[]>(["", ""]);

  function updateVideo(i: number, value: string) {
    setVideoUrls(videoUrls.map((v, idx) => (idx === i ? value : v)));
  }

  function addVideoField() {
    if (videoUrls.length < 4) {
      setVideoUrls([...videoUrls, ""]);
    }
  }

  function removeVideoField(i: number) {
    setVideoUrls(videoUrls.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanedVideoUrls = videoUrls
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    setLoading(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          location,
          instagramHandle,
          tiktokHandle,
          about,
          videoUrls: cleanedVideoUrls,
          canCommit: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="mt-4 text-xl font-semibold text-slate-900">
          Application received!
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Thanks, {name}. We review applications within 3 business days. If
          you&apos;re a fit, we&apos;ll reach out at{" "}
          <strong className="text-slate-900">{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Full name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Creator"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Phone</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Location (City, State)
          </Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Brooklyn, NY"
          />
        </div>
      </div>

      {/* Social handles */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Instagram handle (optional)
          </Label>
          <Input
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="@yourhandle"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            TikTok handle (optional)
          </Label>
          <Input
            value={tiktokHandle}
            onChange={(e) => setTiktokHandle(e.target.value)}
            placeholder="@yourhandle"
          />
        </div>
      </div>

      {/* Video links */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">
          Links to 2–4 of your best videos{" "}
          <span className="text-red-500">*</span>
        </Label>
        <p className="text-xs text-slate-500">
          Any short-form content that shows you on camera. TikTok, Reels,
          Shorts, personal, or brand work — all fine.
        </p>
        <div className="mt-2 space-y-2">
          {videoUrls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => updateVideo(i, e.target.value)}
                placeholder="https://www.tiktok.com/@you/video/..."
              />
              {videoUrls.length > 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0 text-slate-400 hover:text-red-500"
                  onClick={() => removeVideoField(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {videoUrls.length < 4 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVideoField}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add another video
            </Button>
          )}
        </div>
      </div>

      {/* About */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">
          Tell us about yourself <span className="text-red-500">*</span>
        </Label>
        <p className="text-xs text-slate-500">
          What you&apos;ve done, what brands you&apos;d love to work with, how
          much capacity you have.
        </p>
        <Textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Hey! I'm Jane, I've been posting lifestyle content on TikTok for a year and..."
          rows={5}
          required
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full bg-slate-900 text-white hover:bg-slate-800"
        size="lg"
        disabled={loading}
      >
        {loading ? "Submitting..." : "Submit application"}
      </Button>

      <p className="text-center text-xs text-slate-400">
        We review within 3 business days. If you&apos;re a fit, we&apos;ll send
        a short video call invite.
      </p>
    </form>
  );
}
