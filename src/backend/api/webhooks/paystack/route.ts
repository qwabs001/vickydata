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
      data?: { reference?: string; metadata?: { orderId?: string } };
    };

    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const reference = event.data?.reference ?? event.data?.metadata?.orderId;
    if (!reference) {
      return NextResponse.json({ received: true });
    }

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
