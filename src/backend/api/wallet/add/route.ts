import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";

const addSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid top up request." }, { status: 400 });
    }

    const { userId, amount } = parsed.data;
    const current = await prisma.walletBalance.findUnique({ where: { userId } });
    const before = current?.currentBalance ?? 0;
    const after = Math.round((before + amount) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      await tx.walletBalance.upsert({
        where: { userId },
        create: {
          userId,
          totalAdded: amount,
          totalSpent: 0,
          currentBalance: after
        },
        update: {
          totalAdded: { increment: amount },
          currentBalance: after
        }
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type: "ADDED",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          description: "Wallet top up"
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        return NextResponse.json(
          { error: "Wallet storage is not initialized yet." },
          { status: 503 }
        );
      }
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Wallet storage is not initialized yet." },
        { status: 503 }
      );
    }
    console.error("Wallet add error:", error);
    return NextResponse.json({ error: "Unable to add funds." }, { status: 500 });
  }
}
