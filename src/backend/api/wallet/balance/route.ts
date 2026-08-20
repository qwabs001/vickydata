import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({
        totalAdded: 0,
        totalSpent: 0,
        currentBalance: 0
      });
    }

    const balance = await prisma.walletBalance.findUnique({
      where: { userId }
    });

    if (!balance) {
      return NextResponse.json({
        totalAdded: 0,
        totalSpent: 0,
        currentBalance: 0
      });
    }

    return NextResponse.json(
      {
        totalAdded: balance.totalAdded,
        totalSpent: balance.totalSpent,
        currentBalance: balance.currentBalance
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, no-store"
        }
      }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        return NextResponse.json({
          totalAdded: 0,
          totalSpent: 0,
          currentBalance: 0
        });
      }
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({
        totalAdded: 0,
        totalSpent: 0,
        currentBalance: 0
      });
    }
    console.error("Wallet balance error:", error);
    return NextResponse.json(
      {
        totalAdded: 0,
        totalSpent: 0,
        currentBalance: 0
      },
      { status: 500 }
    );
  }
}
