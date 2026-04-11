import { PageHeader } from "@/components/shared/page-header";

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  return (
    <div>
      <PageHeader title="Creator Detail" description={`Creator ${creatorId}`} />
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">Creator detail page coming soon</p>
      </div>
    </div>
  );
}
