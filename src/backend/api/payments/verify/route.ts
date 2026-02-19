import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { paystackService } from "@/backend/services/payments/paystackService";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

const bodySchema = z.object({
  reference: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Reference is required." },
        { status: 400 }
      );
    }

    const { reference } = parsed.data;

    const order = await prisma.order.findFirst({
      where: { paymentReference: reference }
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found for this payment reference." },
        { status: 404 }
      );
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json({
        status: "COMPLETED",
        order: { id: order.id, orderNumber: order.orderNumber }
      });
    }

    const verifyResult = await paystackService.verifyPayment(reference);

    if (!verifyResult.ok) {
      return NextResponse.json(
        { status: "PENDING", error: "Payment not yet confirmed." },
        { status: 400 }
      );
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
      console.error("Fulfillment error after verify:", err);
    }

    const updated = await prisma.order.findUnique({
      where: { id: order.id }
    });

    return NextResponse.json({
      status: "COMPLETED",
      order: updated
        ? {
            id: updated.id,
            orderNumber: updated.orderNumber,
            status: updated.status
          }
        : undefined
    });
  } catch (error) {
    console.error("Payment verify error:", error);
    return NextResponse.json(
      { error: "Unable to verify payment." },
      { status: 500 }
    );
  }
}
