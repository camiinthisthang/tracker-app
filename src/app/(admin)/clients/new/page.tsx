import { requireSuperAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { NewClientForm } from "@/components/clients/new-client-form";

export default async function NewClientPage() {
  await requireSuperAdmin();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New client"
        description="Create a client workspace. You can invite their manager afterwards."
      />
      <NewClientForm />
    </div>
  );
}
