import { NextResponse } from "next/server";
import { quickOrderSchema } from "@/shared/schemas/quickOrder.schema";
import { quickOrderService } from "@/backend/services/orders/quickOrderService";

export async function POST(request: Request) {
  const body = await request.json();
  const data = quickOrderSchema.parse(body);

  const result = await quickOrderService.createQuickOrder({
    username: data.username,
    phoneNumber: data.phoneNumber,
    password: data.password,
    networkId: data.networkId,
    dataPlanId: data.dataPlanId,
    recipientNumber: data.recipientNumber,
    referralCode: data.referralCode ?? null
  });

  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.reason }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: result.user.id,
      username: result.user.username,
      phoneNumber: result.user.phoneNumber,
      role: result.user.role
    },
    order: {
      id: result.order.id,
      orderNumber: result.order.orderNumber,
      amount: result.order.amount
    },
    paymentUrl: result.payment.paymentUrl,
    sessionToken: "mock-session"
  });
}
