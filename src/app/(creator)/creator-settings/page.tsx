import { PageHeader } from "@/components/shared/page-header";

// TODO(cami): orphan? Stub page. Creator-facing settings already live on the
// Profile page (notification prefs, TikTok connect). This page is listed in
// the creator sidebar but has no content.
export default function CreatorSettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Your preferences" />
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">
          Your account preferences (notifications, connected accounts) live on
          your Profile page.
        </p>
      </div>
    </div>
  );
}
