import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;

    const referredUsers = await prisma.user.findMany({
      where: { referredById: id },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderNumber: true,
            amount: true,
            status: true,
            createdAt: true,
            network: { select: { name: true } },
            dataPlan: { select: { name: true, dataAmount: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      referrals: referredUsers.map((u) => ({
        id: u.id,
        username: u.username,
        phoneNumber: u.phoneNumber,
        createdAt: u.createdAt.toISOString(),
        ordersCount: u._count.orders,
        orders: u.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          amount: o.amount,
          status: o.status,
          network: o.network.name,
          plan: `${o.dataPlan.dataAmount} ${o.dataPlan.name}`,
          createdAt: o.createdAt.toISOString()
        }))
      }))
    });
  } catch (error) {
    console.error("Referrals fetch error:", error);
    return NextResponse.json({ error: "Unable to load referrals." }, { status: 500 });
  }
}
