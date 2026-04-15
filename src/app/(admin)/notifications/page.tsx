import { PageHeader } from "@/components/shared/page-header";

// TODO(cami): orphan? Top-level notifications page is just a stub. The real
// per-campaign NotificationRule CRUD already lives at
// /campaigns/[id]/notifications — this page may be redundant.
export default function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications" description="Manage notification rules" />
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">Notifications coming soon</p>
      </div>
    </div>
  );
}
