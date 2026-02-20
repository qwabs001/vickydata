import { NextResponse } from "next/server";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { prisma } from "@/backend/lib/db/prisma";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";
import { enqueueWebhookIfStatusChanged } from "@/backend/services/reseller/statusHooks";

type ActionType = "resend" | "cancel" | "complete" | "cancel_refund" | "deduct_wallet";

async function notifyResellerOrderStatusChange(orderId: string): Promise<void> {
  try {
    await enqueueWebhookIfStatusChanged(orderId);
  } catch (error) {
    console.error("[Admin actions] Reseller webhook enqueue error:", error);
  }
}

async function refundToWallet(order: {
  id: string;
  userId: string;
  amount: number;
  rewardUsed: number | null;
  rewardEarned: number | null;
  orderNumber: string;
}) {
  await prisma.$transaction(async (tx) => {
    const rewardUsed = order.rewardUsed ?? 0;
    const rewardEarned = order.rewardEarned ?? 0;

    if (rewardEarned > 0) {
      const existing = await tx.rewardsBalance.findUnique({
        where: { userId: order.userId }
      });
      const before = existing?.currentBalance ?? 0;
      const after = Math.round((before - rewardEarned) * 100) / 100;
      const safeAfter = Math.max(0, after);
      await tx.rewardsBalance.upsert({
        where: { userId: order.userId },
        create: {
          userId: order.userId,
          totalEarned: 0,
          totalSpent: 0,
          totalWithdrawn: 0,
          currentBalance: safeAfter
        },
        update: {
          totalEarned: { decrement: rewardEarned },
          currentBalance: safeAfter
        }
      });
      await tx.rewardsTransaction.create({
        data: {
          userId: order.userId,
          type: "ADJUSTED",
          amount: -rewardEarned,
          balanceBefore: before,
          balanceAfter: safeAfter,
          description: `Reversal: cashback revoked (${order.orderNumber})`,
          referenceNumber: `RWD-REV-${Date.now()}`
        }
      });
    }

    if (rewardUsed > 0) {
      const existing = await tx.rewardsBalance.findUnique({
        where: { userId: order.userId }
      });
      const before = existing?.currentBalance ?? 0;
      const after = Math.round((before + rewardUsed) * 100) / 100;
      await tx.rewardsBalance.upsert({
        where: { userId: order.userId },
        create: {
          userId: order.userId,
          totalEarned: existing?.totalEarned ?? 0,
          totalSpent: existing?.totalSpent ?? 0,
          totalWithdrawn: existing?.totalWithdrawn ?? 0,
          currentBalance: after
        },
        update: {
          totalSpent: { decrement: rewardUsed },
          currentBalance: after
        }
      });
      await tx.rewardsTransaction.create({
        data: {
          userId: order.userId,
          type: "ADJUSTED",
          amount: rewardUsed,
          balanceBefore: before,
          balanceAfter: after,
          description: `Refund reward used (${order.orderNumber})`,
          referenceNumber: `RWD-RFD-${Date.now()}`
        }
      });
    }

    const amount = order.amount ?? 0;
    if (amount > 0) {
      const wallet = await tx.walletBalance.findUnique({
        where: { userId: order.userId }
      });
      const before = wallet?.currentBalance ?? 0;
      const after = Math.round((before + amount) * 100) / 100;
      await tx.walletBalance.upsert({
        where: { userId: order.userId },
        create: {
          userId: order.userId,
          totalAdded: amount,
          totalSpent: 0,
          currentBalance: after
        },
        update: {
          totalAdded: { increment: amount },
          currentBalance: { increment: amount }
        }
      });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          type: "ADDED",
          amount,
          balanceBefore: before,
          balanceAfter: after,
          description: `Refund: order cancelled (${order.orderNumber})`
        }
      });
    }
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body?.action as ActionType | undefined;

    if (!action || !["resend", "cancel", "complete", "cancel_refund", "deduct_wallet"].includes(action)) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const adminId = request.headers.get("x-user-id") ?? undefined;

    if (action === "resend") {
      // Allow resending even if payment not completed (admin has funds in provider)
      if (order.status === "COMPLETED" && order.apiResponsePayload) {
        return NextResponse.json({ error: "Order already completed." }, { status: 400 });
      }
      // Remove payment status check - allow admin to resend regardless of payment status
      try {
        const result = await dataProviderService.fulfillOrder(order.id);
        if (result.ok) {
          return NextResponse.json({ ok: true, reference: result.reference });
        }
        return NextResponse.json({ error: result.error ?? "Fulfillment failed." }, { status: 400 });
      } catch (fulfillError) {
        console.error("[Admin actions] FulfillOrder error:", fulfillError);
        const errorMsg = fulfillError instanceof Error ? fulfillError.message : "Fulfillment failed.";
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
    }

    if (action === "complete") {
      await prisma.order.update({
        where: { id },
        data: {
          status: "COMPLETED",
          paymentStatus: "COMPLETED",
          failedReason: null,
          completedAt: new Date(),
          processedBy: adminId ?? null
        }
      });
      try {
        const { sendOrderCompleteSms } = await import("@/backend/services/smsNotifications");
        await sendOrderCompleteSms(id);
      } catch (smsErr) {
        console.error("[Admin] Order complete SMS error:", smsErr);
      }
      await notifyResellerOrderStatusChange(id);
      return NextResponse.json({ ok: true });
    }

    if (action === "deduct_wallet") {
      if (order.paymentMethod === "WALLET") {
        return NextResponse.json({ error: "Order already paid from wallet." }, { status: 400 });
      }
      const amount = Number(order.amount) || 0;
      if (amount <= 0) {
        return NextResponse.json({ error: "Order has no amount to deduct." }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const wallet = await tx.walletBalance.findUnique({
          where: { userId: order.userId }
        });
        const before = wallet?.currentBalance ?? 0;
        const after = Math.round((before - amount) * 100) / 100;
        if (after < 0) {
          throw new Error("User wallet balance would go negative. Add funds first or use a different action.");
        }
        await tx.walletBalance.upsert({
          where: { userId: order.userId },
          create: {
            userId: order.userId,
            totalAdded: wallet?.totalAdded ?? 0,
            totalSpent: amount,
            currentBalance: after
          },
          update: {
            totalSpent: { increment: amount },
            currentBalance: after
          }
        });
        await tx.walletTransaction.create({
          data: {
            userId: order.userId,
            type: "SPENT",
            amount,
            balanceBefore: before,
            balanceAfter: after,
            description: `Admin correction: paid for order ${order.orderNumber}`
          }
        });
        await tx.order.update({
          where: { id },
          data: {
            paymentMethod: "WALLET",
            paymentStatus: "COMPLETED",
            status: order.status === "PENDING" ? "PROCESSING" : order.status,
            processedBy: adminId ?? null
          }
        });
      });
      await notifyResellerOrderStatusChange(id);
      return NextResponse.json({ ok: true, message: "Wallet deducted and order updated." });
    }

    if (action === "cancel_refund") {
    if (order.paymentStatus !== "COMPLETED" && order.paymentMethod !== "WALLET") {
        return NextResponse.json({ error: "Payment not completed." }, { status: 400 });
      }
      if (order.paymentStatus === "REFUNDED") {
        return NextResponse.json({ error: "Order already refunded." }, { status: 400 });
      }

      await refundToWallet({
        id: order.id,
        userId: order.userId,
        amount: order.amount,
        rewardUsed: order.rewardUsed ?? 0,
        rewardEarned: order.rewardEarned ?? 0,
        orderNumber: order.orderNumber
      });

      await prisma.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          failedReason: "Cancelled by admin (refunded)",
          processedBy: adminId ?? null
        }
      });

      await notifyResellerOrderStatusChange(id);
      return NextResponse.json({ ok: true });
    }

    // cancel without refund
    await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        failedReason: "Cancelled by admin",
        processedBy: adminId ?? null
      }
    });
    await notifyResellerOrderStatusChange(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Order action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    try {
      const { id: errorOrderId } = await params;
      const errorBody = await request.json().catch(() => ({}));
      const errorAction = errorBody?.action;
      console.error("Order action error details:", { errorMessage, errorStack, action: errorAction, orderId: errorOrderId });
    } catch {
      console.error("Order action error details:", { errorMessage, errorStack });
    }
    return NextResponse.json(
      { error: "Unable to process action.", details: process.env.NODE_ENV === "development" ? errorMessage : undefined },
      { status: 500 }
    );
  }
}
