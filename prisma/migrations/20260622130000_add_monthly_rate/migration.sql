-- AlterTable: per-creator-per-campaign monthly rate (USD) for payout calc
ALTER TABLE "campaign_creators" ADD COLUMN "monthlyRate" DECIMAL(10,2);
