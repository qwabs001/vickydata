import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { resolveAppUrl } from "@/backend/lib/utils/appUrl";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { paystackService } from "@/backend/services/payments/paystackService";
import { resolvePriceForUser } from "@/backend/services/agentPricingService";
import { orderService } from "@/backend/services/orders/orderService";

const bodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  ref: z.string().min(1),
  type: z.enum(["order", "wallet"]).default("wallet"),
  // Order-specific fields (only needed for type: "order")
  networkId: z.string().optional(),
  dataPlanId: z.string().optional(),
  recipientNumber: z.string().optional(),
  rewardToUse: z.number().optional(),
  useWallet: z.boolean().optional()
});

function getReturnPathForRole(role?: string | null): string {
  if (role === "ADMIN") return "/admin";
  if (role === "AGENT") return "/agent";
  return "/dashboard";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request. Required: userId, amount, ref." },
        { status: 400 }
      );
    }

    const { userId, amount, currency, ref, type } = parsed.data;

    // Validate order fields
    if (type === "order") {
      if (!parsed.data.networkId || !parsed.data.dataPlanId || !parsed.data.recipientNumber) {
        return NextResponse.json(
          { error: "Order payment requires networkId, dataPlanId, and recipientNumber." },
          { status: 400 }
        );
      }
    }

    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage.includes("MaxClientsInSessionMode") || errorMessage.includes("connection")) {
        console.error("[Paystack Initialize] Database connection error:", errorMessage);
        return NextResponse.json(
          { error: "Database temporarily unavailable. Please try again in a moment." },
          { status: 503 }
        );
      }
      throw error;
    }

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { paystack } = await getPaymentSettings();
    const secretKey = paystack.secretKey || process.env.PAYSTACK_SECRET_KEY || "";

    console.log("[Paystack Initialize] Settings check:", {
      hasDbSecretKey: !!paystack.secretKey,
      hasEnvSecretKey: !!process.env.PAYSTACK_SECRET_KEY,
      secretKeyLength: secretKey.length,
      userId,
      amount,
      type
    });

    if (!secretKey) {
      return NextResponse.json(
        { error: "Paystack credentials not configured. Please configure Paystack in Admin → Payment Settings." },
        { status: 500 }
      );
    }

    let chargeAmount = amount;
    let chargeCurrency = currency ?? "GHS";
    let orderId: string | null = null;

    // For orders, create the order first
    if (type === "order" && parsed.data.dataPlanId) {
      const selectedPlan = await prisma.dataPlan.findUnique({
        where: { id: parsed.data.dataPlanId },
        select: { price: true, currency: true, networkId: true }
      });

      if (!selectedPlan) {
        return NextResponse.json({ error: "Data plan not found." }, { status: 404 });
      }

      if (parsed.data.networkId && selectedPlan.networkId !== parsed.data.networkId) {
        return NextResponse.json({ error: "Data plan does not match selected network." }, { status: 400 });
      }

      chargeAmount = await resolvePriceForUser(selectedPlan.price, userId);
      chargeCurrency = selectedPlan.currency ?? chargeCurrency;

      // Create order
      const order = await orderService.createOrder({
        userId,
        networkId: parsed.data.networkId!,
        dataPlanId: parsed.data.dataPlanId!,
        recipientNumber: parsed.data.recipientNumber!,
        amount: chargeAmount,
        currency: chargeCurrency,
        rewardToUse: parsed.data.rewardToUse ?? 0,
        useWallet: parsed.data.useWallet ?? false
      });

      orderId = order.id;
    }

    const baseUrl = resolveAppUrl(request);
    const returnPath = getReturnPathForRole(user.role);
    const returnUrl = `${baseUrl.replace(/\/$/, "")}${returnPath}?payment=success`;

    // Initialize Paystack payment
    // callback_url = where Paystack redirects the USER after payment (your site). Webhook is configured separately in Paystack dashboard.
    // Ensure we have a valid email for Paystack
    let userEmail = user.fullName || user.username || user.phoneNumber || "customer";
    // If it doesn't look like an email, make it one
    if (!userEmail.includes("@")) {
      userEmail = `${userEmail.replace(/[^a-zA-Z0-9]/g, "")}@bundlearena.com`;
    }
    
    console.log("[Paystack Initialize] Initializing payment:", {
      orderId: orderId || userId,
      orderNumber: ref,
      amount: chargeAmount,
      email: userEmail,
      returnUrl
    });

    const paymentResult = await paystackService.initializePayment({
      orderId: orderId || userId, // Use orderId if available, otherwise userId for wallet
      orderNumber: ref,
      amount: chargeAmount,
      email: userEmail,
      callbackUrl: returnUrl,
      secretKey
    });

    // Store payment intent
    const intentMetadata = JSON.parse(JSON.stringify({
      clientRef: ref,
      type,
      intentKind: type === "order" ? "ORDER" : "WALLET_TOPUP",
      networkId: parsed.data.networkId ?? null,
      dataPlanId: parsed.data.dataPlanId ?? null,
      recipientNumber: parsed.data.recipientNumber ?? null,
      rewardToUse: parsed.data.rewardToUse ?? 0,
      useWallet: parsed.data.useWallet ?? false,
      orderId: orderId ?? null,
      returnUrl,
      createdAt: new Date().toISOString()
    }));

    await prisma.paymentIntent.upsert({
      where: { reference: paymentResult.reference },
      create: {
        userId,
        provider: "PAYSTACK",
        type: type === "order" ? "ORDER" : "WALLET_TOPUP",
        status: "INITIATED",
        amount: chargeAmount,
        currency: chargeCurrency,
        reference: paymentResult.reference,
        clientReference: ref,
        metadata: intentMetadata,
        rawInit: { authorizationUrl: paymentResult.paymentUrl }
      },
      update: {
        status: "INITIATED",
        amount: chargeAmount,
        currency: chargeCurrency,
        clientReference: ref,
        metadata: intentMetadata,
        rawInit: { authorizationUrl: paymentResult.paymentUrl },
        lastError: null
      }
    });

    // If order was created, update it with payment reference
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentReference: paymentResult.reference }
      });
    }

    return NextResponse.json({
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.reference
    });
  } catch (error) {
    console.error("[Paystack Initialize] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unable to initialize payment.";
    console.error("[Paystack Initialize] Error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
