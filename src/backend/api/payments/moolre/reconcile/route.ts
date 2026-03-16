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

async function processIntent(intent: {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  reference: string;
  clientReference: string | null;
  type: "ORDER" | "WALLET_TOPUP";
  metadata: unknown;
}) {
  const pending = pendingFromIntent(intent);

  const { moolre } = await getPaymentSettings();
  const pubKey = moolre.pubKey || process.env.MOOLRE_PUB_KEY || "";
  const accountNumber = moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "";

  const candidates = Array.from(
    new Set(
      [intent.reference, intent.clientReference].filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    )
  );
  let confirmed = false;
  let verifiedRef = intent.reference;
  let verificationData: Record<string, unknown> | null = null;
  let verificationJson: Prisma.InputJsonValue | undefined;
  let lastReason: string[] | null = null;

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
      lastReason = verification?.reasons ?? ["not_confirmed"];
    } catch (err) {
      lastReason = [err instanceof Error ? err.message : "verification_error"];
    }
  }

  if (!confirmed) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "FAILED",
        lastError: lastReason?.join(", ") ?? "not_confirmed"
      }
    }).catch(() => {});
    return { processed: false, reason: lastReason ?? ["not_confirmed"] };
  }

  if (pending.type === "order") {
    if (!pending.networkId || !pending.dataPlanId || !pending.recipientNumber) {
      return { processed: false, reason: ["invalid_order_fields"] };
    }

    const locked = await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { not: "CONFIRMED" } },
      data: { status: "PENDING", lastError: null }
    });
    if (locked.count === 0) {
      return { processed: true, alreadyProcessed: true };
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

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: "CONFIRMED",
        verifiedAt: new Date(),
        rawVerify: verificationJson,
        lastError: null
      }
    }).catch(() => {});

    try {
      await orderService.recordDirectPurchaseWalletTransaction(order.id);
    } catch (walletErr) {
      console.error("[Moolre reconcile] Wallet ledger error:", walletErr);
    }

    try {
      const { dataProviderService } = await import(
        "@/backend/services/dataProvider/dataProviderService"
      );
      await dataProviderService.fulfillOrder(order.id);
    } catch (err) {
      console.error("[Moolre reconcile] Fulfillment error:", err);
    }

    return { processed: true };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentIntent.updateMany({
      where: { id: intent.id, status: { not: "CONFIRMED" } },
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

  return { processed: true };
}

async function processPending(pending: PendingPayment, recordKey: string) {
  // Verify with Moolre
  const { moolre } = await getPaymentSettings();
  const pubKey = moolre.pubKey || process.env.MOOLRE_PUB_KEY || "";
  const accountNumber = moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "";

  const candidates = Array.from(new Set([pending.ref].filter(Boolean)));
  let confirmed = false;
  let verifiedRef = pending.ref;
  let lastReason: string[] | null = null;

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
        break;
      }
      lastReason = verification?.reasons ?? ["not_confirmed"];
    } catch (err) {
      lastReason = [err instanceof Error ? err.message : "verification_error"];
    }
  }

  if (!confirmed) {
    return { processed: false, reason: lastReason ?? ["not_confirmed"] };
  }

  if (pending.type === "order") {
    if (!pending.networkId || !pending.dataPlanId || !pending.recipientNumber) {
      return { processed: false, reason: ["invalid_order_fields"] };
    }

    const existingOrder = await prisma.order.findFirst({
      where: { paymentReference: pending.ref ?? verifiedRef }
    });
    if (existingOrder) {
      try {
        await orderService.recordDirectPurchaseWalletTransaction(existingOrder.id);
      } catch (walletErr) {
        console.error("[Moolre reconcile] Wallet ledger error:", walletErr);
      }
      await prisma.settings.delete({ where: { key: recordKey } }).catch(() => {});
      return { processed: true, alreadyProcessed: true };
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

    try {
      await orderService.recordDirectPurchaseWalletTransaction(order.id);
    } catch (walletErr) {
      console.error("[Moolre reconcile] Wallet ledger error:", walletErr);
    }

    try {
      const { dataProviderService } = await import(
        "@/backend/services/dataProvider/dataProviderService"
      );
      await dataProviderService.fulfillOrder(order.id);
    } catch (err) {
      console.error("[Moolre reconcile] Fulfillment error:", err);
    }

    await prisma.settings.delete({ where: { key: recordKey } }).catch(() => {});
    return { processed: true };
  }

  const existingTxn = await prisma.walletTransaction.findFirst({
    where: {
      userId: pending.userId,
      type: "ADDED",
      description: { contains: pending.ref }
    }
  });
  if (existingTxn) {
    await prisma.settings.delete({ where: { key: recordKey } }).catch(() => {});
    return { processed: true, alreadyProcessed: true };
  }

  const wallet = await prisma.walletBalance.findUnique({
    where: { userId: pending.userId }
  });
  const before = wallet?.currentBalance ?? 0;
  const after = Math.round((before + pending.amount) * 100) / 100;

  await prisma.walletBalance.upsert({
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

  await prisma.walletTransaction.create({
    data: {
      userId: pending.userId,
      type: "ADDED",
      amount: pending.amount,
      balanceBefore: before,
      balanceAfter: after,
      description: `Added via Moolre (${pending.ref ?? verifiedRef})`
    }
  });

  await prisma.settings.delete({ where: { key: recordKey } }).catch(() => {});
  return { processed: true };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const intents = await prisma.paymentIntent.findMany({
      where: {
        userId,
        provider: "MOOLRE",
        status: { in: ["INITIATED", "PENDING"] }
      }
    });

    const pendingRecords = await prisma.settings.findMany({
      where: { category: "pending_payment" }
    });

    const userPending = pendingRecords.filter((record) => {
      const val = record.value as unknown as PendingPayment;
      return val?.userId === userId;
    });

    if (userPending.length === 0 && intents.length === 0) {
      return NextResponse.json({ status: "ok", pending: 0, processed: 0 });
    }

    let processed = 0;
    let confirmed = 0;
    const errors: Record<string, string[]> = {};

    for (const intent of intents) {
      try {
        const result = await processIntent(intent);
        processed += 1;
        if (result.processed) {
          confirmed += 1;
        } else if (result.reason) {
          errors[intent.reference] = result.reason;
        }
      } catch (err) {
        processed += 1;
        errors[intent.reference] = [
          err instanceof Error ? err.message : "processing_error"
        ];
      }
    }

    for (const record of userPending) {
      const pending = record.value as unknown as PendingPayment;
      try {
        const result = await processPending(pending, record.key);
        processed += 1;
        if (result.processed) {
          confirmed += 1;
        } else if (result.reason) {
          errors[pending.ref] = result.reason;
        }
      } catch (err) {
        processed += 1;
        errors[pending.ref] = [
          err instanceof Error ? err.message : "processing_error"
        ];
      }
    }

    return NextResponse.json({
      status: "ok",
      pending: userPending.length,
      processed,
      confirmed,
      errors
    });
  } catch (error) {
    console.error("[Moolre reconcile] Error:", error);
    return NextResponse.json(
      { error: "Unable to reconcile pending payments." },
      { status: 500 }
    );
  }
}
