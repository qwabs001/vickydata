import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { paystackService } from "@/backend/services/payments/paystackService";

const bodySchema = z.object({
  orderId: z.string().min(1),
  callbackUrl: z.string().url().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "orderId is required." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Order already completed." },
        { status: 400 }
      );
    }

    const payment = await paystackService.initializePayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.amount,
      email: null,
      callbackUrl: parsed.data.callbackUrl
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: payment.reference }
    });

    return NextResponse.json({
      paymentUrl: payment.paymentUrl,
      reference: payment.reference
    });
  } catch (error) {
    console.error("Payment initialize error:", error);
    return NextResponse.json(
      { error: "Unable to initialize payment." },
      { status: 500 }
    );
  }
}
