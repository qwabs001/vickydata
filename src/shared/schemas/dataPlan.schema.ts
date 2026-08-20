import { z } from "zod";

export const dataPlanSchema = z.object({
  networkId: z.string().min(1),
  name: z.string().min(1),
  dataAmount: z.string().min(1),
  dataInMB: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().default("GHS"),
  validity: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0)
});
