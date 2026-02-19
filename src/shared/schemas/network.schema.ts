import { z } from "zod";

export const networkSchema = z.object({
  name: z.string().min(2),
  displayName: z.string().min(2),
  logoUrl: z.string().min(1),
  sortOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true)
});
