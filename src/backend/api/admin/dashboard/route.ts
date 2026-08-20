import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";

const revenueWhere: Prisma.OrderWhereInput = {
  paymentStatus: "COMPLETED",
  status: { notIn: ["FAILED", "CANCELLED"] }
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return auth.response;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const last7DaysStart = new Date(todayStart);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);

    const [
      revenueAggregate,
      paidOrdersCount,
      activeOrdersCount,
      ordersTodayCount,
      totalCustomersCount,
      activeCustomersCount,
      recentOrders,
      topNetworkGroups,
      revenueOrdersLast7Days
    ] = await Promise.all([
      prisma.order.aggregate({
        where: revenueWhere,
        _sum: { amount: true }
      }),
      prisma.order.count({
        where: revenueWhere
      }),
      prisma.order.count({
        where: {
          status: { in: ["PENDING", "PROCESSING"] }
        }
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: todayStart }
        }
      }),
      prisma.user.count({
        where: {
          role: { in: ["CUSTOMER", "AGENT"] }
        }
      }),
      prisma.user.count({
        where: {
          role: { in: ["CUSTOMER", "AGENT"] },
          status: "ACTIVE"
        }
      }),
      prisma.order.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 4,
        include: {
          network: true,
          dataPlan: true,
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              phoneNumber: true
            }
          }
        }
      }),
      prisma.order.groupBy({
        by: ["networkId"],
        where: revenueWhere,
        _sum: { amount: true },
        orderBy: {
          _sum: { amount: "desc" }
        },
        take: 5
      }),
      prisma.order.findMany({
        where: {
          ...revenueWhere,
          createdAt: { gte: last7DaysStart }
        },
        select: {
          amount: true,
          createdAt: true
        }
      })
    ]);

    const topNetworkIds = topNetworkGroups.map((item) => item.networkId);
    const networks = topNetworkIds.length > 0
      ? await prisma.network.findMany({
          where: { id: { in: topNetworkIds } },
          select: { id: true, name: true, displayName: true }
        })
      : [];
    const networkById = new Map(networks.map((network) => [network.id, network]));

    const totalRevenue = revenueAggregate._sum.amount ?? 0;
    const rewardsLiability = totalRevenue * 0.01;

    const revenueByDay = new Map<string, number>();
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(last7DaysStart);
      day.setDate(last7DaysStart.getDate() + i);
      revenueByDay.set(day.toISOString().slice(0, 10), 0);
    }
    for (const order of revenueOrdersLast7Days) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      revenueByDay.set(dateKey, (revenueByDay.get(dateKey) ?? 0) + Number(order.amount ?? 0));
    }

    const revenueChartData = Array.from(revenueByDay.entries()).map(([date, value]) => {
      const day = new Date(`${date}T00:00:00.000Z`);
      return {
        date,
        label: day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
        value
      };
    });

    return NextResponse.json(
      {
        summary: {
          totalRevenue,
          paidOrdersCount,
          activeOrdersCount,
          totalCustomersCount,
          activeCustomersCount,
          rewardsLiability,
          ordersToday: ordersTodayCount
        },
        topNetworks: topNetworkGroups.map((item) => {
          const network = networkById.get(item.networkId);
          return {
            id: item.networkId,
            label: network?.displayName ?? network?.name ?? "Unknown",
            amount: item._sum.amount ?? 0
          };
        }),
        revenueChartData,
        recentOrders: recentOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          amount: order.amount,
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
          network: order.network
            ? {
                id: order.network.id,
                name: order.network.name,
                displayName: order.network.displayName
              }
            : null,
          dataPlan: order.dataPlan
            ? {
                id: order.dataPlan.id,
                name: order.dataPlan.name,
                dataAmount: order.dataPlan.dataAmount
              }
            : null,
          user: order.user
            ? {
                id: order.user.id,
                username: order.user.username,
                fullName: order.user.fullName,
                phoneNumber: order.user.phoneNumber
              }
            : null
        }))
      },
      { headers: { "Cache-Control": "private, max-age=0, no-store" } }
    );
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json(
      { error: "Unable to load dashboard." },
      { status: 500 }
    );
  }
}
