import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { getRequestIp, recordActivity } from "@/backend/lib/activityLog";
import { hashPassword } from "@/backend/lib/utils/hash";

const updateSchema = z.object({
  username: z.string().min(1).optional(),
  phoneNumber: z.string().min(6).optional(),
  role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
  vip: z.boolean().optional(),
  password: z.string().min(6).max(120).optional(),
  rewardsAdjustment: z.number().min(-100000).max(100000).optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const adminId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid user payload." }, { status: 400 });
    }

    const updates = parsed.data;
    let preferencesUpdate: Prisma.InputJsonValue | undefined;
    const rewardsAdjustment = Number(updates.rewardsAdjustment ?? 0);

    if (updates.vip !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id },
        select: { preferences: true }
      });
      const existing =
        (current?.preferences as Prisma.JsonObject | null) ?? {};
      preferencesUpdate = { ...existing, vip: updates.vip } as Prisma.InputJsonValue;
    }

    const passwordHash = updates.password ? await hashPassword(updates.password) : undefined;
    const userUpdateData: Prisma.UserUpdateInput = {
      username: updates.username,
      phoneNumber: updates.phoneNumber,
      role: updates.role,
      status: updates.status,
      preferences: preferencesUpdate,
      password: passwordHash
    };

    const { user, rewardsBalance } = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: userUpdateData
      });

      if (rewardsAdjustment === 0) {
        const existingBalance = await tx.rewardsBalance.findUnique({
          where: { userId: id }
        });
        return { user: updatedUser, rewardsBalance: existingBalance?.currentBalance ?? 0 };
      }

      const existingBalance = await tx.rewardsBalance.findUnique({
        where: { userId: id }
      });
      const before = existingBalance?.currentBalance ?? 0;
      const after = Math.round((before + rewardsAdjustment) * 100) / 100;

      if (after < 0) {
        throw new Error("Rewards adjustment would make balance negative.");
      }

      const nextBalance = await tx.rewardsBalance.upsert({
        where: { userId: id },
        create: {
          userId: id,
          totalEarned: rewardsAdjustment > 0 ? rewardsAdjustment : 0,
          totalSpent: rewardsAdjustment < 0 ? Math.abs(rewardsAdjustment) : 0,
          totalWithdrawn: 0,
          currentBalance: after
        },
        update: {
          totalEarned: rewardsAdjustment > 0 ? { increment: rewardsAdjustment } : undefined,
          totalSpent: rewardsAdjustment < 0 ? { increment: Math.abs(rewardsAdjustment) } : undefined,
          currentBalance: after
        }
      });

      await tx.rewardsTransaction.create({
        data: {
          userId: id,
          type: "ADJUSTED",
          amount: rewardsAdjustment,
          balanceBefore: before,
          balanceAfter: after,
          description: `Admin adjustment (${rewardsAdjustment > 0 ? "+" : ""}${rewardsAdjustment.toFixed(2)})`,
          referenceNumber: `ADM-RWD-${Date.now()}`
        }
      });

      return { user: updatedUser, rewardsBalance: nextBalance.currentBalance };
    });

    await recordActivity({
      userId: adminId,
      action: "Updated user",
      resource: user.username ?? user.phoneNumber ?? id,
      category: "Settings",
      details: {
        role: user.role,
        status: user.status,
        passwordReset: Boolean(updates.password),
        rewardsAdjustment: rewardsAdjustment || 0
      },
      ipAddress: getRequestIp(request)
    });

    return NextResponse.json({
      id: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      status: user.status,
      role: user.role,
      preferences: user.preferences,
      rewardsBalance
    });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Unable to update user." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }
    const adminId = request.headers.get("x-user-id");
    const { id } = await context.params;
    const user = await prisma.user.update({
      where: { id },
      data: { status: "DELETED" }
    });
    await recordActivity({
      userId: adminId,
      action: "Deleted user",
      resource: user.username ?? user.phoneNumber ?? id,
      category: "Settings",
      ipAddress: getRequestIp(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("User delete error:", error);
    return NextResponse.json({ error: "Unable to delete user." }, { status: 500 });
  }
}
