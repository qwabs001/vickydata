import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { moolreService } from "@/backend/services/payments/moolreService";
import { orderService } from "@/backend/services/orders/orderService";

type PendingPayment = {
  userId: string;
  amount: number;
  currency: string;
  type: "order" | "wallet";
  ref: string;
  networkId: string | null;
  dataPlanId: string | null;
  recipientNumber: string | null;
  rewardToUse: number;
  useWallet: boolean;
};

type IntentMetadata = {
  networkId?: string | null;
  dataPlanId?: string | null;
  recipientNumber?: string | null;
  rewardToUse?: number;
  useWallet?: boolean;
};

function pendingFromIntent(intent: {
  userId: string;
  amount: number;
  currency: string;
  type: "ORDER" | "WALLET_TOPUP";
  reference: string;
  metadata: unknown;
}): PendingPayment {
  const meta = (intent.metadata ?? {}) as IntentMetadata;
  return {
    userId: intent.userId,
    amount: intent.amount,
    currency: intent.currency,
    type: intent.type === "ORDER" ? "order" : "wallet",
    ref: intent.reference,
    networkId: meta.networkId ?? null,
    dataPlanId: meta.dataPlanId ?? null,
    recipientNumber: meta.recipientNumber ?? null,
    rewardToUse: meta.rewardToUse ?? 0,
    useWallet: meta.useWallet ?? false
  };
}

/**
 * GET /api/payments/moolre/status?ref=XXX
 *
 * Used when the user returns to the site after paying (e.g. closed Moolre tab
 * before redirect, or Moolre never redirected). If payment was completed but
 * our callback was never hit, we verify with Moolre and process the order/wallet.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref =
    url.searchParams.get("ref") ??
    url.searchParams.get("reference") ??
    url.searchParams.get("transaction_ref") ??
    url.searchParams.get("txn_ref");

  if (!ref) {
    return NextResponse.json({ error: "Missing ref parameter." }, { status: 400 });
  }

  try {
    // 1. Check if order already exists
    const existingOrder = await prisma.order.findFirst({
      where: { paymentReference: ref }
    });
    if (existingOrder) {
      return NextResponse.json({
        status: "completed",
        type: "order",
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber
      });
    }

    // 2. Check for payment intent or legacy pending payment
    let paymentIntent = await prisma.paymentIntent.findFirst({
      where: {
        provider: "MOOLRE",
        OR: [{ reference: ref }, { clientReference: ref }]
      }
    });

    let pendingRecord: { key: string; value: unknown } | null = null;
    let pending: PendingPayment | null = null;

    if (paymentIntent) {
      pending = pendingFromIntent({
        userId: paymentIntent.userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        type: paymentIntent.type,
        reference: paymentIntent.reference,
        metadata: paymentIntent.metadata
      });
    } else {
      let legacyRecord = await prisma.settings.findUnique({
        where: { key: `pending_payment.${ref}` }
      });

      if (!legacyRecord) {
        const allPending = await prisma.settings.findMany({
          where: { category: "pending_payment" }
        });
        for (const record of allPending) {
          const val = record.value as unknown as PendingPayment;
          if (val?.ref === ref) {
            legacyRecord = record;
            break;
          }
        }
      }

      if (legacyRecord) {
        pendingRecord = { key: legacyRecord.key, value: legacyRecord.value };
        pending = legacyRecord.value as unknown as PendingPayment;
      }
    }

    if (!pending) {
      return NextResponse.json({ status: "not_found", message: "No order or pending payment for this reference." });
    }

    // 3. Verify with Moolre — MUST succeed before crediting
    let verifiedRef = ref;
    let verificationData: Record<string, unknown> | null = null;
    let verificationJson: Prisma.InputJsonValue | undefined;
    try {
      const { moolre } = await getPaymentSettings();
      const pubKey = moolre.pubKey || process.env.MOOLRE_PUB_KEY || "";
      const accountNumber = moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "";

      const candidates = Array.from(
        new Set(
          [
            ref,
            pending.ref,
            paymentIntent?.reference,
            paymentIntent?.clientReference
          ].filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );
      let confirmed = false;

      for (const candidate of candidates) {
        try {
          const verification = await moolreService.verifyPayment({
            reference: candidate,
            accountNumber,
            credentials: pubKey ? { pubKey } : undefined,
            expectedAmount: pending.amount,
            expectedCurrency: pending.currency,
            expectedReferences: candidates
          });
          if (verification?.status && verification.confirmed) {
            confirmed = true;
            verifiedRef = candidate;
            verificationData = (verification.data as Record<string, unknown>) ?? null;
            if (verificationData) {
              verificationJson = JSON.parse(JSON.stringify(verificationData)) as Prisma.InputJsonValue;
            }
            break;
          }
        } catch {
          /* continue */
        }
      }

      if (!confirmed) {
        return NextResponse.json({
          status: "pending",
          message: "Payment not yet confirmed. Please wait and try again."
        });
      }
    } catch {
      // Payment cancelled, failed, or not yet confirmed — do NOT credit
      return NextResponse.json({
        status: "pending",
        message: "Payment not yet confirmed. Please wait and try again."
      });
    }

    // 4. Process payment (same logic as callback)
    if (pending.type === "order") {
      if (!pending.networkId || !pending.dataPlanId || !pending.recipientNumber) {
        return NextResponse.json({ error: "Invalid pending order data." }, { status: 400 });
      }

      if (paymentIntent) {
        const locked = await prisma.paymentIntent.updateMany({
          where: { id: paymentIntent.id, status: { not: "CONFIRMED" } },
          data: { status: "PENDING", lastError: null }
        });
        if (locked.count === 0) {
          return NextResponse.json({
            status: "completed",
            type: "order"
          });
        }
      }

      const order = await orderService.createOrder({
        userId: pending.userId,
        networkId: pending.networkId,
        dataPlanId: pending.dataPlanId,
        recipientNumber: pending.recipientNumber,
        amount: pending.amount,
        currency: pending.currency,
        rewardToUse: pending.rewardToUse,
        useWallet: false
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          paymentStatus: "COMPLETED",
          paymentMethod: "MOOLRE",
          paymentReference: pending.ref ?? verifiedRef
        }
      });

      if (paymentIntent) {
        await prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: "CONFIRMED",
            verifiedAt: new Date(),
            rawVerify: verificationJson,
            lastError: null
          }
        }).catch(() => {});
      }

      try {
        const { dataProviderService } = await import(
          "@/backend/services/dataProvider/dataProviderService"
        );
        await dataProviderService.fulfillOrder(order.id);
      } catch (err) {
        console.error("[Moolre status] Fulfillment error:", err);
      }

      // Clean up pending payment
      if (pendingRecord) {
        await prisma.settings.delete({
          where: { key: pendingRecord.key }
        }).catch(() => {});
      }

      return NextResponse.json({
        status: "completed",
        type: "order",
        orderId: order.id,
        orderNumber: order.orderNumber
      });
    }

    // Wallet top-up
    await prisma.$transaction(async (tx) => {
      if (paymentIntent) {
        const updated = await tx.paymentIntent.updateMany({
          where: { id: paymentIntent.id, status: { not: "CONFIRMED" } },
          data: {
            status: "CONFIRMED",
            verifiedAt: new Date(),
            rawVerify: verificationJson,
            lastError: null
          }
        });
        if (updated.count === 0) {
          return;
        }
      }

      const wallet = await tx.walletBalance.findUnique({
        where: { userId: pending.userId }
      });
      const before = wallet?.currentBalance ?? 0;
      const after = Math.round((before + pending.amount) * 100) / 100;

      await tx.walletBalance.upsert({
        where: { userId: pending.userId },
        create: {
          userId: pending.userId,
          totalAdded: pending.amount,
          totalSpent: 0,
          currentBalance: after
        },
        update: {
          totalAdded: { increment: pending.amount },
          currentBalance: { increment: pending.amount }
        }
      });

      await tx.walletTransaction.create({
        data: {
          userId: pending.userId,
          type: "ADDED",
          amount: pending.amount,
          balanceBefore: before,
          balanceAfter: after,
          description: `Added via Moolre (${pending.ref ?? verifiedRef})`
        }
      });
    });

    if (pendingRecord) {
      await prisma.settings.delete({
        where: { key: pendingRecord.key }
      }).catch(() => {});
    }

    return NextResponse.json({
      status: "completed",
      type: "wallet"
    });
  } catch (error) {
    console.error("[Moolre status] Error:", error);
    return NextResponse.json(
      { error: "Unable to check payment status." },
      { status: 500 }
    );
  }
}
