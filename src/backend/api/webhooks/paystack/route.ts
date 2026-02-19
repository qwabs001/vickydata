import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/backend/lib/db/prisma";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature") ?? "";

    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
    if (webhookSecret) {
      const hash = crypto
        .createHmac("sha512", webhookSecret)
        .update(body)
        .digest("hex");
      if (hash !== signature) {
        return NextResponse.json({ received: false }, { status: 401 });
      }
    }

    const event = JSON.parse(body) as {
      event?: string;
      data?: {
        reference?: string;
        metadata?: { orderId?: string; type?: string };
        amount?: number;
        customer?: { email?: string };
      };
    };

    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const reference = event.data?.reference;
    if (!reference) {
      return NextResponse.json({ received: true });
    }

    // Check if this is an agent upgrade payment
    const paymentIntent = await prisma.paymentIntent.findUnique({
      where: { reference },
      include: { user: true }
    });

    if (paymentIntent) {
      const metadata = paymentIntent.metadata as { type?: string; orderId?: string } | null;
      const wasAlreadyConfirmed = paymentIntent.status === "CONFIRMED";

      if (!wasAlreadyConfirmed) {
        await prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: "CONFIRMED",
            verifiedAt: new Date(),
            rawVerify: JSON.parse(JSON.stringify(event.data || {}))
          }
        });
      }

      // Handle agent upgrade
      if (metadata?.type === "agent_upgrade") {
        const user = paymentIntent.user;
        if (user && user.role !== "AGENT" && user.role !== "ADMIN") {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "AGENT" }
          });
          console.log("[Paystack webhook] Agent upgrade processed:", user.id);
        }
        return NextResponse.json({ received: true });
      }

      // Handle wallet top-up (only if not already processed by verify-return)
      if (
        !wasAlreadyConfirmed &&
        paymentIntent.type === "WALLET_TOPUP" &&
        metadata?.type !== "agent_upgrade"
      ) {
        const user = paymentIntent.user;
        if (user) {
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
          console.log("[Paystack webhook] Wallet top-up processed:", user.id, paymentIntent.amount);
        }
        return NextResponse.json({ received: true });
      }

      // Handle order payment via paymentIntent metadata (only if not already processed)
      if (!wasAlreadyConfirmed && metadata?.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: metadata.orderId }
        });

        if (order && order.status !== "COMPLETED") {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: "COMPLETED",
              paymentMethod: "CARD"
            }
          });

          try {
            await dataProviderService.fulfillOrder(order.id);
            console.log("[Paystack webhook] Order fulfilled:", order.id);
          } catch (err) {
            console.error("Paystack webhook fulfillment error:", err);
          }
        }
        return NextResponse.json({ received: true });
      }
    }

    // Handle regular order payments
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { paymentReference: reference },
          { id: reference }
        ]
      }
    });

    if (!order || order.status === "COMPLETED") {
      return NextResponse.json({ received: true });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "COMPLETED",
        paymentMethod: "CARD"
      }
    });

    try {
      await dataProviderService.fulfillOrder(order.id);
    } catch (err) {
      console.error("Paystack webhook fulfillment error:", err);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
