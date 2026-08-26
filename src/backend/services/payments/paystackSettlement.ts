import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { matchesPaystackPayment } from "./paystackRules";

type VerifiedCharge = { reference: string; amount: number; currency: string; status: string };

// Callback and webhook share this transaction. The conditional intent update
// locks the row; losing retries never repeat a credit, upgrade or order insert.
export async function settlePaystackCharge(charge: VerifiedCharge, db?: PrismaClient) {
  db ??= (await import("@/backend/lib/db/prisma")).prisma;
  return db.$transaction(async tx => {
    const intent = await tx.paymentIntent.findUnique({ where: { reference: charge.reference } });
    if (!intent || intent.provider !== "PAYSTACK") return { status: "not_found" };
    if (!matchesPaystackPayment(intent, charge)) throw new Error("Payment amount, currency or reference mismatch.");
    const meta = (intent.metadata ?? {}) as { type?: string; orderId?: string; networkId?: string; dataPlanId?: string; recipientNumber?: string };
    if (intent.status === "CANCELLED") throw new Error("Payment was cancelled. Contact support for reconciliation.");
    const claimed = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: { in: ["INITIATED", "PENDING", "FAILED"] } },
      data: { status: "CONFIRMED", verifiedAt: new Date(), rawVerify: charge as Prisma.InputJsonObject, lastError: null } });
    if (!claimed.count) {
      const existing = intent.type === "ORDER" ? await tx.order.findFirst({ where: { paymentReference: intent.reference } }) : null;
      return { status: "completed", type: meta.type, orderId: existing?.id, orderNumber: existing?.orderNumber };
    }
    if (intent.type === "ORDER") {
      let order;
      if (meta.orderId) {
        order = await tx.order.findUnique({ where: { id: meta.orderId } });
        if (!order || order.userId !== intent.userId || order.status === "CANCELLED" || order.paymentStatus === "REFUNDED" ||
            order.paymentStatus === "COMPLETED" || order.paymentReference !== intent.reference ||
            Math.round(order.amount * 100) !== charge.amount || order.currency !== charge.currency) throw new Error("Order cannot accept this payment.");
        order = await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "COMPLETED", paymentMethod: "PAYSTACK" } });
      } else {
        if (!meta.networkId || !meta.dataPlanId || !meta.recipientNumber) throw new Error("Missing order details.");
        const activeProvider = await tx.apiConfiguration.findFirst({ where: { isActive: true, networkId: null }, select: { id: true } });
        order = await tx.order.create({ data: {
          orderNumber: `GH-${randomUUID()}`, userId: intent.userId, networkId: meta.networkId,
          dataPlanId: meta.dataPlanId, recipientNumber: meta.recipientNumber, amount: intent.amount, currency: intent.currency,
          paymentReference: intent.reference, paymentStatus: "COMPLETED", paymentMethod: "PAYSTACK", status: "PENDING",
          autoFulfillmentEligible: !!activeProvider
        } });
      }
      const wallet = await tx.walletBalance.findUnique({ where: { userId: intent.userId } });
      await tx.walletTransaction.create({ data: { userId: intent.userId, type: "SPENT", amount: intent.amount,
        balanceBefore: wallet?.currentBalance ?? 0, balanceAfter: wallet?.currentBalance ?? 0,
        description: `Bundle purchase (${order.orderNumber})` } });
      return { status: "completed", type: "order", orderId: order.id, orderNumber: order.orderNumber };
    }
    if (meta.type === "agent_upgrade") {
      await tx.user.updateMany({ where: { id: intent.userId, role: "CUSTOMER" }, data: { role: "AGENT" } });
      return { status: "completed", type: "agent_upgrade" };
    }
    // Upsert locks the wallet row even for simultaneous different top-ups.
    const wallet = await tx.walletBalance.upsert({ where: { userId: intent.userId },
      create: { userId: intent.userId, totalAdded: intent.amount, currentBalance: intent.amount, totalSpent: 0 },
      update: { currentBalance: { increment: intent.amount }, totalAdded: { increment: intent.amount } } });
    await tx.walletTransaction.create({ data: { userId: intent.userId, type: "ADDED", amount: intent.amount,
      balanceBefore: Math.round((wallet.currentBalance - intent.amount) * 100) / 100, balanceAfter: wallet.currentBalance,
      description: `Added via Paystack (${intent.reference})` } });
    return { status: "completed", type: "wallet" };
  });
}

export async function verifyAndSettlePaystack(reference: string) {
  const { prisma } = await import("@/backend/lib/db/prisma");
  const { getPaystackSecret } = await import("./paystackCheckoutService");
  const intent = await prisma.paymentIntent.findUnique({ where: { reference } });
  if (!intent || intent.provider !== "PAYSTACK") return { status: "not_found" };
  const secret = await getPaystackSecret();
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15000), cache: "no-store"
  });
  if (!response.ok) throw new Error("Unable to verify payment with Paystack. Please retry.");
  const result = await response.json();
  if (!result.status || result.data?.status !== "success") return { status: "pending" };
  if (!matchesPaystackPayment(intent, result.data)) throw new Error("Paystack verification does not match the saved payment.");
  return settlePaystackCharge({ reference: result.data.reference, amount: result.data.amount, currency: result.data.currency, status: result.data.status });
}

export async function dispatchPaidPaystackOrder(orderId?: string) {
  if (!orderId) return;
  const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
  await dataProviderService.fulfillOrder(orderId);
}
