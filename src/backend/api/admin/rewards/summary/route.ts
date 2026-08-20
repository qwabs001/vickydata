import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const [balanceAgg, earnedAgg, spentAgg, withdrawnAgg] = await Promise.all([
      prisma.rewardsBalance.aggregate({ _sum: { currentBalance: true } }),
      prisma.rewardsBalance.aggregate({ _sum: { totalEarned: true } }),
      prisma.rewardsBalance.aggregate({ _sum: { totalSpent: true } }),
      prisma.rewardsBalance.aggregate({ _sum: { totalWithdrawn: true } })
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyEarned = await prisma.rewardsTransaction.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: { gte: monthStart },
        type: { in: ["EARNED", "ADJUSTED"] }
      }
    });

    return NextResponse.json({
      availableBalance: balanceAgg._sum.currentBalance ?? 0,
      totalEarned: earnedAgg._sum.totalEarned ?? 0,
      totalSpent: spentAgg._sum.totalSpent ?? 0,
      totalWithdrawn: withdrawnAgg._sum.totalWithdrawn ?? 0,
      monthlyEarned: monthlyEarned._sum.amount ?? 0
    });
  } catch (error) {
    console.error("Rewards summary error:", error);
    return NextResponse.json({ error: "Unable to load rewards summary." }, { status: 500 });
  }
}
