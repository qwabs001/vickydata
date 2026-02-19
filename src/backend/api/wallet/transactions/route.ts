import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ transactions: [] });
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      transactions: transactions.map((item) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        balanceBefore: item.balanceBefore,
        balanceAfter: item.balanceAfter,
        description: item.description,
        createdAt: item.createdAt.toISOString()
      }))
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        return NextResponse.json({ transactions: [] });
      }
    }
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json({ transactions: [] });
    }
    console.error("Wallet transactions error:", error);
    return NextResponse.json({ error: "Unable to load wallet transactions." }, { status: 500 });
  }
}
