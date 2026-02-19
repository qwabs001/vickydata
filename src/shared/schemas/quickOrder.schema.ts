import { z } from "zod";

export const quickOrderSchema = z
  .object({
    username: z.string().min(3),
    phoneNumber: z.string().min(10),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
    networkId: z.string().min(1),
    dataPlanId: z.string().min(1),
    recipientNumber: z.string().min(10),
    rewardToUse: z.number().nonnegative().optional(),
    referralCode: z.string().min(3).optional()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
