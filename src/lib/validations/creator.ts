import { z } from "zod";

export const createCreatorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  handle: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  teamId: z.string().min(1).optional(),
  tier: z.enum(["TRAINING", "BRONZE", "SILVER", "GOLD"]).default("TRAINING"),
  isActive: z.boolean().default(true),
  sendInvite: z.boolean().default(true),
});

export const updateCreatorSchema = createCreatorSchema.partial();

export type CreateCreatorInput = z.infer<typeof createCreatorSchema>;
