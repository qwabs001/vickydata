import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";

const createSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["EARNED", "ADJUSTED", "SPENT", "EXPIRED"]),
  description: z.string().min(1).optional()
});

const updateBalance = async (userId: string, type: string, amount: number) => {
  const current = await prisma.rewardsBalance.findUnique({ where: { userId } });
  const before = current?.currentBalance ?? 0;
  let after = before;
  let totalEarned = current?.totalEarned ?? 0;
  let totalSpent = current?.totalSpent ?? 0;
  let totalWithdrawn = current?.totalWithdrawn ?? 0;

  if (type === "EARNED" || type === "ADJUSTED") {
    after = Math.round((before + amount) * 100) / 100;
    totalEarned = Math.round((totalEarned + amount) * 100) / 100;
  } else if (type === "SPENT" || type === "EXPIRED") {
    after = Math.round((before - amount) * 100) / 100;
    totalSpent = Math.round((totalSpent + amount) * 100) / 100;
  }

  const balance = await prisma.rewardsBalance.upsert({
    where: { userId },
    create: {
      userId,
      totalEarned,
      totalSpent,
      totalWithdrawn,
      currentBalance: after
    },
    update: {
      totalEarned,
      totalSpent,
      totalWithdrawn,
      currentBalance: after
    }
  });

  return { before, after, balance };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ transactions: [] });
    }

    const transactions = await prisma.rewardsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        order: {
          select: {
            amount: true,
            status: true,
            user: { select: { username: true } }
          }
        }
      }
    });

    return NextResponse.json(
      {
      transactions: transactions.map((transaction) => {
        const base = {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          referenceNumber: transaction.referenceNumber,
          createdAt: transaction.createdAt.toISOString()
        };
        if (transaction.order) {
          return {
            ...base,
            orderAmount: transaction.order.amount,
            referredUsername: transaction.order.user?.username ?? null
          };
        }
        return base;
      })
    },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30"
        }
      }
    );
  } catch (error) {
    console.error("Rewards transactions error:", error);
    return NextResponse.json({ error: "Unable to load transactions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid transaction payload." }, { status: 400 });
    }

    const { userId, amount, type, description } = parsed.data;
    const { before, after } = await updateBalance(userId, type, amount);

    const transaction = await prisma.rewardsTransaction.create({
      data: {
        userId,
        type,
        amount: Math.round(amount * 100) / 100,
        balanceBefore: before,
        balanceAfter: after,
        description: description ?? type,
        referenceNumber: `${type.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      }
    });

    return NextResponse.json({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      referenceNumber: transaction.referenceNumber,
      createdAt: transaction.createdAt.toISOString()
    });
  } catch (error) {
    console.error("Rewards transaction create error:", error);
    return NextResponse.json({ error: "Unable to create transaction." }, { status: 500 });
  }
}
