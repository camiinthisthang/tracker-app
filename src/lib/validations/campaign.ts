import { z } from "zod";

export const campaignCreatorSchema = z.object({
  // Reference an existing Creator by id — admins pick from the roster rather
  // than typing handles. Handles are owned by creators via /profile.
  creatorId: z.string().min(1, "creatorId is required"),
  platform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK"]),
  videosPerDay: z.coerce.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export const createCampaignSchema = z.object({
  // Optional: agency super admins / agency managers send the client team's id
  // explicitly so the campaign attaches to the right client. Client managers
  // omit this and the API falls back to their own teamId.
  teamId: z.string().optional(),
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
