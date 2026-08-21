import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { isDatabaseConnectionError } from "@/backend/lib/utils/dbError";
import { comparePassword, hashPassword } from "@/backend/lib/utils/hash";
import {
  isPhoneLoginIdentity,
  normalizePhoneNumber,
  normalizeUsername
} from "@/backend/services/auth/authIdentity";

export const authService = {
  async ensureDevAdmin(username: string, password: string) {
    if (process.env.NODE_ENV === "production") return null;

    const adminUsername = "Bomzydget2@gmail.com";
    const adminPhone = "0200000000";
    const adminPassword = "Orange$1234";
    const normalizedUsername = normalizeUsername(username);

    if (normalizedUsername.toLowerCase() !== adminUsername.toLowerCase() || password !== adminPassword) {
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
      const normalizedUsername = normalizeUsername(username);
      const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: normalizedUsername } },
            { phoneNumber: normalizedPhoneNumber }
          ]
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
          username: normalizedUsername,
          phoneNumber: normalizedPhoneNumber,
          password: hashed,
          role: "CUSTOMER",
          status: "ACTIVE",
          referredById: referrer?.id ?? null
        }
      });
      return { ok: true, user } as const;
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        return { ok: false, reason: "Service temporarily unavailable. Please try again in a moment." } as const;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return { ok: false, reason: "Username or phone number already exists." } as const;
        }
      }
      console.error("[AuthService] createUser error:", error);
      return { ok: false, reason: "Unable to create account. Please try again." } as const;
    }
  },

  async validateUser(username: string, password: string) {
    try {
      const normalizedUsername = normalizeUsername(username);
      let user = await prisma.user.findFirst({
        where: {
          username: {
            equals: normalizedUsername
          }
        }
      });

      if (!user && isPhoneLoginIdentity(normalizedUsername)) {
        user = await prisma.user.findUnique({
          where: {
            phoneNumber: normalizePhoneNumber(normalizedUsername)
          }
        });
      }

      if (!user) return null;
      const valid = await comparePassword(password, user.password);
      return valid ? user : null;
    } catch (error) {
      if (isDatabaseConnectionError(error)) {
        throw error;
      }
      console.error("[AuthService] validateUser error:", error);
      return null;
    }
  },

  async resetPassword(username: string, phoneNumber: string, password: string) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername
        },
        phoneNumber: normalizedPhoneNumber
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
