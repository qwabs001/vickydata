import { prisma } from "@/backend/lib/db/prisma";
import { hashPassword } from "@/backend/lib/utils/hash";

export const quickSignupService = {
  async signup(
    username: string,
    phoneNumber: string,
    password: string,
    referralCode?: string | null
  ) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { phoneNumber }]
      }
    });
    if (existing) {
      return { ok: false, reason: "Username or phone number already registered." } as const;
    }

    const referrer = referralCode
      ? await prisma.user.findUnique({ where: { referralCode } })
      : null;

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        phoneNumber,
        password: hashed,
        role: "CUSTOMER",
        status: "ACTIVE",
        referredById: referrer?.id ?? null
      }
    });

    return { ok: true, user } as const;
  }
};
