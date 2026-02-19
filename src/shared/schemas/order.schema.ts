import { z } from "zod";

export const orderCreateSchema = z.object({
  networkId: z.string().min(1),
  dataPlanId: z.string().min(1),
  recipientNumber: z.string().min(10),
  rewardToUse: z.number().nonnegative().optional(),
  /** When true, amount is deducted from user wallet immediately. Must be explicitly true for wallet payment. */
  useWallet: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === true || v === "true")
});
