import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";

const getCustomerVisibleStatus = (status: string) => {
  if (status === "FAILED") return "PENDING";
  return status;
};

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    let order = await prisma.order.findUnique({
      where: { id },
      include: {
        network: true,
        dataPlan: true,
        user: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "PROCESSING") {
      try {
        const { dataProviderService } = await import("@/backend/services/dataProvider/dataProviderService");
        await dataProviderService.syncOrderStatus(order.id);
        order = await prisma.order.findUnique({
          where: { id },
          include: {
            network: true,
            dataPlan: true,
            user: true
          }
        });
      } catch (syncError) {
        console.error("Order detail sync warning:", syncError);
      }
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: getCustomerVisibleStatus(order.status),
        paymentStatus: order.paymentStatus,
        amount: order.amount,
        currency: order.currency,
        recipientNumber: order.recipientNumber,
        createdAt: order.createdAt.toISOString(),
        network: order.network,
        dataPlan: order.dataPlan,
        user: {
          id: order.user.id,
          username: order.user.username,
          phoneNumber: order.user.phoneNumber
        }
      }
    });
  } catch (error) {
    console.error("Order detail error:", error);
    return NextResponse.json({ error: "Unable to fetch order." }, { status: 500 });
  }
}

export async function PATCH() {
  return NextResponse.json({ ok: false, message: "Not implemented" }, { status: 501 });
}
