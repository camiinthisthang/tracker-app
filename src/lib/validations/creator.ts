import { z } from "zod";

export const createCreatorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  handle: z.string().min(1, "Handle is required"),
  email: z.string().email().optional().or(z.literal("")),
  tier: z.enum(["TRAINING", "BRONZE", "SILVER", "GOLD"]).default("TRAINING"),
  isActive: z.boolean().default(true),
});

export const updateCreatorSchema = createCreatorSchema.partial();

export type CreateCreatorInput = z.infer<typeof createCreatorSchema>;
