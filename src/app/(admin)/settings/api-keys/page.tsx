import { PageHeader } from "@/components/shared/page-header";

// TODO(cami): orphan? Page is a stub with no UI. The ApiKey model exists but
// there's nothing to manage internal API keys. This page is not linked from
// any sidebar — only reachable by URL.
export default function APIKeysPage() {
  return (
    <div>
      <PageHeader title="APIKeys" description="Manage API keys for external integrations" />
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">APIKeys coming soon</p>
      </div>
    </div>
  );
}
