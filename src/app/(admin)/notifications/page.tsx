import { PageHeader } from "@/components/shared/page-header";

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
