import { prisma } from "@/backend/lib/db/prisma";
import { quickSignupService } from "@/backend/services/auth/quickSignupService";
import { orderService } from "@/backend/services/orders/orderService";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { moolreService } from "@/backend/services/payments/moolreService";

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
    const callbackUrl = `${appUrl}/api/payments/moolre/callback`;
    const returnUrl = `${appUrl}/dashboard?payment=success`;
    const reference = `ORDER-${signup.user.id}-${Date.now()}`;

    const { moolre } = await getPaymentSettings();
    const payment = await moolreService.initiateHostedCheckout({
      amount: order.amount,
      currency: order.currency,
      reference,
      email: signup.user.username || signup.user.phoneNumber || "",
      callbackUrl,
      returnUrl,
      accountNumber: moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "",
      credentials: {
        pubKey: moolre.pubKey || process.env.MOOLRE_PUB_KEY || ""
      }
    });

    const metadata = JSON.parse(JSON.stringify({
      clientRef: reference,
      type: "order",
      intentKind: "ORDER",
      orderId: order.id,
      networkId: payload.networkId,
      dataPlanId: payload.dataPlanId,
      recipientNumber: payload.recipientNumber,
      rewardToUse: 0,
      useWallet: false,
      callbackUrl,
      returnUrl,
      createdAt: new Date().toISOString()
    }));

    await prisma.paymentIntent.upsert({
      where: { reference: payment.reference },
      create: {
        userId: signup.user.id,
        provider: "MOOLRE",
        type: "ORDER",
        status: "INITIATED",
        amount: order.amount,
        currency: order.currency,
        reference: payment.reference,
        clientReference: reference,
        metadata,
        rawInit: { authorizationUrl: payment.authorizationUrl }
      },
      update: {
        status: "INITIATED",
        amount: order.amount,
        currency: order.currency,
        clientReference: reference,
        metadata,
        rawInit: { authorizationUrl: payment.authorizationUrl },
        lastError: null
      }
    });

    const pendingValue = JSON.parse(JSON.stringify({
      userId: signup.user.id,
      amount: order.amount,
      currency: order.currency,
      type: "order",
      ref: payment.reference,
      networkId: payload.networkId,
      dataPlanId: payload.dataPlanId,
      recipientNumber: payload.recipientNumber,
      rewardToUse: 0,
      useWallet: false,
      orderId: order.id,
      createdAt: new Date().toISOString()
    }));

    await prisma.settings.upsert({
      where: { key: `pending_payment.${payment.reference}` },
      create: {
        key: `pending_payment.${payment.reference}`,
        value: pendingValue,
        category: "pending_payment"
      },
      update: { value: pendingValue }
    });

    await prisma.settings.upsert({
      where: { key: `pending_payment.${reference}` },
      create: {
        key: `pending_payment.${reference}`,
        value: pendingValue,
        category: "pending_payment"
      },
      update: { value: pendingValue }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { paymentReference: payment.reference }
    });

    return {
      ok: true,
      user: signup.user,
      order: { ...order, paymentReference: payment.reference },
      payment: {
        paymentUrl: payment.authorizationUrl,
        reference: payment.reference
      }
    } as const;
  }
};
