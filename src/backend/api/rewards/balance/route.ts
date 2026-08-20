import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({
        totalEarned: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        currentBalance: 0
      });
    }

    const balance = await prisma.rewardsBalance.findUnique({
      where: { userId }
    });

    if (!balance) {
      return NextResponse.json({
        totalEarned: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        currentBalance: 0
      });
    }

    return NextResponse.json(
      {
        totalEarned: balance.totalEarned,
        totalSpent: balance.totalSpent,
        totalWithdrawn: balance.totalWithdrawn,
        currentBalance: balance.currentBalance
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30"
        }
      }
    );
  } catch (error) {
    console.error("Rewards balance error:", error);
    return NextResponse.json(
      {
        totalEarned: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        currentBalance: 0
      },
      { status: 500 }
    );
  }
}
