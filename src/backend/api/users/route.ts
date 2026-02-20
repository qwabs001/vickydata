import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const roleParam = (searchParams.get("role") ?? "CUSTOMER").toUpperCase();
    const includeAgents = ["1", "true", "yes"].includes(
      (searchParams.get("includeAgents") ?? "").toLowerCase()
    );
    const roleFilter =
      roleParam === "AGENT" || roleParam === "ADMIN" || roleParam === "CUSTOMER"
        ? roleParam
        : "CUSTOMER";
    const limitParam = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "500") || 500));
    const whereClause: Prisma.UserWhereInput =
      roleFilter === "CUSTOMER" && includeAgents
        ? { role: { in: ["CUSTOMER", "AGENT"] } }
        : { role: roleFilter as UserRole };

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        _count: { select: { orders: true, referrals: true } },
        rewardsBalance: true,
        walletBalance: true
      },
      orderBy: { createdAt: "desc" },
      take: limitParam
    });

    const userIds = users.map((user) => user.id);
    const orderTotals = userIds.length > 0
      ? await prisma.order.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds }
          },
          _sum: { amount: true }
        })
      : [];
    const amountByUser = new Map(
      orderTotals.map((item) => [item.userId, item._sum.amount ?? 0])
    );

    return NextResponse.json(
      {
        users: users.map((user) => ({
          id: user.id,
          username: user.username ?? user.phoneNumber,
          phoneNumber: user.phoneNumber,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
          ordersCount: user._count.orders,
          ordersTotalAmount: amountByUser.get(user.id) ?? 0,
          referralsCount: user._count.referrals,
          rewardsBalance: user.rewardsBalance?.currentBalance ?? 0,
          walletBalance: user.walletBalance?.currentBalance ?? 0,
          walletSpent: user.walletBalance?.totalSpent ?? 0,
          walletAdded: user.walletBalance?.totalAdded ?? 0,
          vip: Boolean((user.preferences as { vip?: boolean } | null)?.vip)
        }))
      },
      { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=20" } }
    );
  } catch (error) {
    console.error("User list error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCode = (error as { code?: string })?.code;
    
    // Check for database connection errors
    if (
      errorMessage.includes("MaxClientsInSessionMode") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("timeout") ||
      errorCode === "P1001" ||
      errorCode === "P1017"
    ) {
      return NextResponse.json(
        { error: "Database temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Unable to fetch users.", details: process.env.NODE_ENV === "development" ? errorMessage : undefined },
      { status: 500 }
    );
  }
}
