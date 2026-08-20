import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";

const withdrawSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  phoneNumber: z.string().min(6).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = withdrawSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid withdrawal request." }, { status: 400 });
    }

    const { userId, amount, phoneNumber } = parsed.data;
    const config = await prisma.rewardsConfig.findFirst({ where: { isActive: true } });
    const configuredMin = config?.minWithdrawalAmount ?? 5;
    const minWithdrawal = Math.max(configuredMin, 300);

    if (amount < minWithdrawal) {
      return NextResponse.json({ error: `Minimum withdrawal is GHS ${minWithdrawal.toFixed(2)}.` }, { status: 400 });
    }

    const balance = await prisma.rewardsBalance.findUnique({ where: { userId } });
    const currentBalance = balance?.currentBalance ?? 0;
    if (amount > currentBalance) {
      return NextResponse.json({ error: "Insufficient rewards balance." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const before = currentBalance;
    const after = Math.round((before - amount) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.rewardsBalance.upsert({
        where: { userId },
        create: {
          userId,
          totalEarned: 0,
          totalSpent: 0,
          totalWithdrawn: amount,
          currentBalance: after
        },
        update: {
          totalWithdrawn: { increment: amount },
          currentBalance: after
        }
      });

      const referenceNumber = `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      await tx.withdrawalRequest.create({
        data: {
          userId,
          amount,
          method: "MOBILE_MONEY",
          recipientDetails: {
            phoneNumber: phoneNumber ?? user.phoneNumber
          },
          status: "PENDING",
          referenceNumber
        }
      });

      await tx.rewardsTransaction.create({
        data: {
          userId,
          type: "WITHDRAWN",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          description: "Withdrawn (MoMo)",
          referenceNumber
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return NextResponse.json({ error: "Unable to submit withdrawal." }, { status: 500 });
  }
}
