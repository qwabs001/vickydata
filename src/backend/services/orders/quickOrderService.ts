import { prisma } from "@/backend/lib/db/prisma";
import { quickSignupService } from "@/backend/services/auth/quickSignupService";
import { orderService } from "@/backend/services/orders/orderService";
import { paystackService } from "@/backend/services/payments/paystackService";

export const quickOrderService = {
  async createQuickOrder(payload: {
    username: string;
    phoneNumber: string;
    password: string;
    networkId: string;
    dataPlanId: string;
    recipientNumber: string;
    referralCode?: string | null;
  }) {
    const signup = await quickSignupService.signup(
      payload.username,
      payload.phoneNumber,
      payload.password,
      payload.referralCode ?? null
    );

    if (!signup.ok) {
      return { ok: false, reason: signup.reason } as const;
    }

    const plan = await prisma.dataPlan.findUnique({
      where: { id: payload.dataPlanId }
    });

    if (!plan) {
      return { ok: false, reason: "Data plan not found." } as const;
    }

    const order = await orderService.createOrder({
      userId: signup.user.id,
      networkId: payload.networkId,
      dataPlanId: payload.dataPlanId,
      recipientNumber: payload.recipientNumber,
      amount: plan.price,
      currency: plan.currency
    });

    const payment = await paystackService.initializePayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.amount,
      email: null
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: payment.reference }
    });

    return {
      ok: true,
      user: signup.user,
      order: { ...order, paymentReference: payment.reference },
      payment
    } as const;
  }
};
