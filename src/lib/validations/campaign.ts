import { z } from "zod";

export const campaignCreatorSchema = z.object({
  handle: z.string().min(1, "Handle is required"),
  creatorName: z.string().optional(),
  platform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK"]),
  videosPerDay: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  isActive: z.boolean().default(true),
  hashtags: z.array(z.string()).default([]),
  weeklyPostTarget: z.coerce.number().int().min(0).default(5),
  ugcEngineer: z.string().optional(),
  previewLinks: z.array(z.string()).default([]),
  galleryUrls: z.array(z.string()).default([]),
  creators: z.array(campaignCreatorSchema).default([]),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type CampaignCreatorInput = z.infer<typeof campaignCreatorSchema>;
