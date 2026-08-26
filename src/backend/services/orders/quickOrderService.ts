import { prisma } from "@/backend/lib/db/prisma";
import { quickSignupService } from "@/backend/services/auth/quickSignupService";
import { orderService } from "@/backend/services/orders/orderService";
import { createPaystackCheckout } from "@/backend/services/payments/paystackCheckoutService";

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

    const appUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      "https://vickydata.com"
    ).replace(/\/$/, "");
    const payment = await createPaystackCheckout({
      request: new Request(appUrl), userId: signup.user.id, amount: order.amount,
      currency: order.currency, ref: `ORDER-${order.id}`, type: "order",
      networkId: payload.networkId, dataPlanId: payload.dataPlanId,
      recipientNumber: payload.recipientNumber, orderId: order.id
    });

    return {
      ok: true,
      user: signup.user,
      order: { ...order, paymentReference: payment.reference },
      payment: {
        paymentUrl: payment.paymentUrl,
        reference: payment.reference
      }
    } as const;
  }
};
