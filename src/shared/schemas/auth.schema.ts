import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6)
});

export const signupSchema = z
  .object({
    username: z.string().min(3),
    phoneNumber: z.string().min(10),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
    referralCode: z.string().min(3).optional()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const resetPasswordSchema = z
  .object({
    username: z.string().min(3),
    phoneNumber: z.string().min(10),
    password: z.string().min(6),
    confirmPassword: z.string().min(6)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
