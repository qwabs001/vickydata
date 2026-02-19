import { NextResponse } from "next/server";
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
    const roleFilter =
      roleParam === "AGENT" || roleParam === "ADMIN" || roleParam === "CUSTOMER"
        ? roleParam
        : "CUSTOMER";
    const limitParam = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "500") || 500));

    const users = await prisma.user.findMany({
      where: { role: roleFilter },
      include: {
        _count: { select: { orders: true, referrals: true } },
        rewardsBalance: true,
        walletBalance: true
      },
      orderBy: { createdAt: "desc" },
      take: limitParam
    });

    const orderTotals = await prisma.order.groupBy({
      by: ["userId"],
      where: {
        userId: { in: users.map((user) => user.id) }
      },
      _sum: { amount: true }
    });
    const amountByUser = new Map(
      orderTotals.map((item) => [item.userId, item._sum.amount ?? 0])
    );

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("User list error:", error);
    return NextResponse.json({ error: "Unable to fetch users." }, { status: 500 });
  }
}
