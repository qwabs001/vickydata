import { z } from "zod";

export const orderCreateSchema = z.object({
  networkId: z.string().min(1),
  dataPlanId: z.string().min(1),
  recipientNumber: z.string().min(10),
  rewardToUse: z.number().nonnegative().optional(),
  useWallet: z.boolean().optional()
});
