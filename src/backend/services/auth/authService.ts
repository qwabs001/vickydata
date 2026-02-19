import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { comparePassword, hashPassword } from "@/backend/lib/utils/hash";

export const authService = {
  async ensureDevAdmin(username: string, password: string) {
    if (process.env.NODE_ENV === "production") return null;

    const adminUsername = "Qwabs";
    const adminPhone = "0200000000";
    const adminPassword = "Enter#@123";

    if (username !== adminUsername || password !== adminPassword) {
      return null;
    }

    const hashed = await hashPassword(adminPassword);
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: adminUsername }, { phoneNumber: adminPhone }] }
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          username: adminUsername,
          phoneNumber: adminPhone,
          password: hashed,
          role: "ADMIN",
          status: "ACTIVE"
        }
      });
    }

    return prisma.user.create({
      data: {
        username: adminUsername,
        phoneNumber: adminPhone,
        password: hashed,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });
  },

  async createUser(
    username: string,
    phoneNumber: string,
    password: string,
    referralCode?: string | null
  ) {
    try {
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ username }, { phoneNumber }]
        }
      });
      if (existing) {
        return { ok: false, reason: "Username or phone number already exists." } as const;
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientInitializationError) {
        return { ok: false, reason: "Database unavailable. Check the connection string." } as const;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return { ok: false, reason: "Username or phone number already exists." } as const;
        }
      }
      return { ok: false, reason: "Unable to create account." } as const;
    }
  },

  async validateUser(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return null;
    const valid = await comparePassword(password, user.password);
    return valid ? user : null;
  },

  async resetPassword(username: string, phoneNumber: string, password: string) {
    const user = await prisma.user.findFirst({
      where: {
        username,
        phoneNumber
      }
    });
    if (!user) {
      return { ok: false, reason: "Username and phone number do not match." } as const;
    }
    const hashed = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed }
    });
    return { ok: true, user } as const;
  }
};
