import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { orderService } from "@/backend/services/orders/orderService";
import { resolvePriceForUser } from "@/backend/services/agentPricingService";
import { orderCreateSchema } from "@/shared/schemas/order.schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const scope = searchParams.get("scope");
    const limitParam = Number(searchParams.get("limit") ?? "0");
    const pageParam = Number(searchParams.get("page") ?? "1");

    if (!userId && scope !== "all") {
      return NextResponse.json({ orders: [] });
    }

    if (scope === "all") {
      const auth = await requireAdmin(request);
      if (!auth.ok) {
        return auth.response;
      }
    }

    // When fetching by userId, allow only that user or an admin
    if (scope !== "all" && userId) {
      const requesterId = request.headers.get("x-user-id");
      if (requesterId !== userId) {
        const auth = await requireAdmin(request);
        if (!auth.ok) {
          return NextResponse.json({ orders: [] });
        }
      }
    }

    // Run sync in background so response isn't delayed (sync can hit external provider API)
    if (scope === "all") {
      void import("@/backend/services/dataProvider/dataProviderService")
        .then(({ dataProviderService }) =>
          dataProviderService.syncRecentInProgressOrders(20).catch((syncError) => {
            console.error("Admin order status sync warning:", syncError);
          })
        )
        .catch((importError) => {
          console.error("Failed to import dataProviderService for admin sync:", importError);
        });
    } else if (userId) {
      void import("@/backend/services/dataProvider/dataProviderService")
        .then(({ dataProviderService }) =>
          dataProviderService.syncUserInProgressOrders(userId).catch((syncError) => {
            console.error("Order status sync warning:", syncError);
          })
        )
        .catch((importError) => {
          console.error("Failed to import dataProviderService for sync:", importError);
        });
    }

    const whereClause = scope === "all" ? undefined : userId ? { userId } : undefined;
    const maxLimit = scope === "all" ? 2000 : 200;
    const requestedLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(maxLimit, Math.floor(limitParam)) : 0;
    const defaultLimit = scope === "all" ? 500 : 100;
    const take = requestedLimit > 0 ? requestedLimit : defaultLimit;
    const page = Math.max(1, Math.floor(pageParam) || 1);
    const skip = (page - 1) * take;
    const shouldPaginate = requestedLimit > 0;

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          network: true,
          dataPlan: true,
          user: scope === "all" ? { select: { id: true, username: true, fullName: true, phoneNumber: true } } : false
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
        skip
      }),
      shouldPaginate ? prisma.order.count({ where: whereClause }) : Promise.resolve(null)
    ]);

    const cacheForCustomer = scope !== "all" ? "private, max-age=10, stale-while-revalidate=20" : undefined;
    return NextResponse.json(
      {
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        failedReason: order.failedReason ?? null,
        amount: order.amount,
        currency: order.currency,
        recipientNumber: order.recipientNumber,
        createdAt: order.createdAt.toISOString(),
        network: order.network
          ? {
              id: order.network.id,
              name: order.network.name,
              displayName: order.network.displayName,
              logoUrl: order.network.logoUrl
            }
          : undefined,
        dataPlan: order.dataPlan
          ? {
              id: order.dataPlan.id,
              name: order.dataPlan.name,
              dataAmount: order.dataPlan.dataAmount,
              validity: order.dataPlan.validity
            }
          : undefined,
        user: order.user
          ? {
              id: order.user.id,
              username: order.user.username,
              fullName: order.user.fullName ?? null,
              phoneNumber: order.user.phoneNumber
            }
          : undefined
      })),
      ...(totalCount != null
        ? {
            pagination: {
              page,
              limit: take,
              total: totalCount,
              hasMore: page * take < totalCount
            }
          }
        : take > 0
          ? { pagination: { page, limit: take, hasMore: orders.length === take } }
          : {})
      },
      cacheForCustomer ? { headers: { "Cache-Control": cacheForCustomer } } : {}
    );
  } catch (error) {
    console.error("Order fetch error:", error);
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
      { error: "Unable to fetch orders.", details: process.env.NODE_ENV === "development" ? errorMessage : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = orderCreateSchema
      .extend({ userId: z.string().min(1) })
      .safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid order payload.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { userId, networkId, dataPlanId, recipientNumber, rewardToUse, useWallet } = parsed.data;
    const requesterId = request.headers.get("x-user-id");
    if (requesterId !== userId) {
      const auth = await requireAdmin(request);
      if (!auth.ok) {
        return NextResponse.json({ error: "You are not allowed to create orders for this user." }, { status: 403 });
      }
    }

    const plan = await prisma.dataPlan.findUnique({
      where: { id: dataPlanId }
    });

    if (!plan) {
      return NextResponse.json({ error: "Data plan not found." }, { status: 404 });
    }

    const effectiveAmount = await resolvePriceForUser(plan.price, userId, plan.agentPrice);

    const order = await orderService.createOrder({
      userId,
      networkId,
      dataPlanId,
      recipientNumber,
      amount: effectiveAmount,
      currency: plan.currency,
      rewardToUse,
      useWallet
    });

    // For wallet/paid orders, send to provider immediately
    // Trigger fulfillment when payment is completed (wallet or payment callback) OR when status is PROCESSING
    const shouldFulfill = order.paymentStatus === "COMPLETED" || order.status === "PROCESSING";
    if (shouldFulfill && order.status !== "COMPLETED" && order.status !== "FAILED") {
      try {
        const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
        const result = await dataProviderService.fulfillOrder(order.id);
        console.log("[orders POST] Fulfillment result:", result);
        if (!result.ok) {
          console.error("[orders POST] Fulfillment failed:", result.error);
        }
      } catch (err) {
        console.error("[orders POST] Order fulfillment error:", err);
      }
    } else if (!shouldFulfill) {
      console.log("[orders POST] Order not ready for fulfillment:", {
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus
      });
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("Order create error:", error);
    const message = error instanceof Error ? error.message : "Unable to create order.";
    if (message === "Insufficient wallet balance.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
