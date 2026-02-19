import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { paystackService } from "@/backend/services/payments/paystackService";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";

/**
 * Verify a Paystack payment by reference and credit wallet / fulfill order if not already done.
 * Called when the user returns from Paystack (callback). Idempotent.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
    const userId = searchParams.get("userId");

    if (!reference.trim()) {
      return NextResponse.json({ error: "Missing reference", credited: false }, { status: 400 });
    }

    const { paystack } = await getPaymentSettings();
    const secretKey = paystack.secretKey || process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Paystack not configured", credited: false }, { status: 500 });
    }

    const verified = await paystackService.verifyPayment(reference);
    if (!verified.ok) {
      return NextResponse.json({ error: "Payment not verified", credited: false }, { status: 400 });
    }

    const paymentIntent = await prisma.paymentIntent.findUnique({
      where: { reference },
      include: { user: true }
    });

    if (!paymentIntent) {
      return NextResponse.json({ error: "Payment intent not found", credited: false }, { status: 404 });
    }

    if (userId && paymentIntent.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized", credited: false }, { status: 403 });
    }

    const metadata = paymentIntent.metadata as { type?: string; orderId?: string } | null;

    if (paymentIntent.status === "CONFIRMED") {
      return NextResponse.json({ credited: true, alreadyProcessed: true });
    }

    await prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: {
        status: "CONFIRMED",
        verifiedAt: new Date()
      }
    });

    const user = paymentIntent.user;
    if (!user) {
      return NextResponse.json({ error: "User not found", credited: false }, { status: 404 });
    }

    if (metadata?.type === "agent_upgrade") {
      if (user.role !== "AGENT" && user.role !== "ADMIN") {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "AGENT" }
        });
      }
      return NextResponse.json({ credited: true, type: "agent_upgrade" });
    }

    if (paymentIntent.type === "WALLET_TOPUP") {
      await prisma.$transaction(async (tx) => {
        const wallet = await tx.walletBalance.findUnique({
          where: { userId: user.id }
        });
        const before = wallet?.currentBalance ?? 0;
        const after = Math.round((before + paymentIntent.amount) * 100) / 100;

        await tx.walletBalance.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            totalAdded: paymentIntent.amount,
            totalSpent: 0,
            currentBalance: after
          },
          update: {
            totalAdded: { increment: paymentIntent.amount },
            currentBalance: after
          }
        });

        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: "ADDED",
            amount: paymentIntent.amount,
            balanceBefore: before,
            balanceAfter: after,
            description: `Added via Paystack (${paymentIntent.reference})`
          }
        });
      });
      return NextResponse.json({ credited: true, type: "wallet", amount: paymentIntent.amount });
    }

    if (metadata?.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: metadata.orderId }
      });
      if (order && order.status !== "COMPLETED") {
        const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "COMPLETED", paymentMethod: "CARD" }
        });
        try {
          await dataProviderService.fulfillOrder(order.id);
        } catch (err) {
          console.error("[Paystack verify-return] Fulfillment error:", err);
        }
      }
      return NextResponse.json({ credited: true, type: "order" });
    }

    return NextResponse.json({ credited: true });
  } catch (error) {
    console.error("[Paystack verify-return] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed", credited: false },
      { status: 500 }
    );
  }
}
