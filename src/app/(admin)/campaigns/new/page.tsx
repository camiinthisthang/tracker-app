import { PageHeader } from "@/components/shared/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div>
      <PageHeader
        title="New Campaign"
        description="Set up a new campaign and add creators"
      />
      <CampaignForm />
    </div>
  );
}
