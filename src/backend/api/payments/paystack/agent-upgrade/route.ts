import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { resolveAppUrl } from "@/backend/lib/utils/appUrl";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { paystackService } from "@/backend/services/payments/paystackService";

const bodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  ref: z.string().min(1)
});

const AGENT_UPGRADE_FEE = 300;

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

    const { userId, currency, ref } = parsed.data;
    const amount = AGENT_UPGRADE_FEE; // Fixed fee

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (user.role === "AGENT" || user.role === "ADMIN") {
      return NextResponse.json(
        { error: "User is already an agent or admin." },
        { status: 400 }
      );
    }

    const baseUrl = resolveAppUrl(request);
    const returnUrl = `${baseUrl.replace(/\/$/, "")}/agent?payment=success`;

    const { paystack } = await getPaymentSettings();
    const secretKey = paystack.secretKey || process.env.PAYSTACK_SECRET_KEY || "";

    if (!secretKey) {
      return NextResponse.json(
        { error: "Paystack credentials not configured. Please configure Paystack in Admin → Payment Settings." },
        { status: 500 }
      );
    }

    // Ensure we send a valid email format to Paystack
    let userEmail = user.fullName || user.username || user.phoneNumber || "customer";
    if (!userEmail.includes("@")) {
      const localPart = userEmail.replace(/[^a-zA-Z0-9._+-]/g, "").toLowerCase();
      userEmail = `${localPart || "customer"}@keldatagh.com`;
    }

    // Initialize Paystack payment (callback_url = where to redirect user after payment)
    const paymentResult = await paystackService.initializePayment({
      orderId: userId, // Using userId as orderId for agent upgrade
      orderNumber: ref,
      amount,
      email: userEmail,
      callbackUrl: returnUrl,
      secretKey
    });

    // Store payment intent
    await prisma.paymentIntent.upsert({
      where: { reference: paymentResult.reference },
      create: {
        userId,
        provider: "PAYSTACK",
        type: "WALLET_TOPUP", // Using WALLET_TOPUP type, but metadata will indicate agent_upgrade
        status: "INITIATED",
        amount,
        currency: currency ?? "GHS",
        reference: paymentResult.reference,
        clientReference: ref,
        metadata: {
          type: "agent_upgrade",
          clientRef: ref,
          returnUrl,
          createdAt: new Date().toISOString()
        },
        rawInit: { authorizationUrl: paymentResult.paymentUrl }
      },
      update: {
        status: "INITIATED",
        amount,
        currency: currency ?? "GHS",
        clientReference: ref,
        metadata: {
          type: "agent_upgrade",
          clientRef: ref,
          returnUrl,
          createdAt: new Date().toISOString()
        },
        rawInit: { authorizationUrl: paymentResult.paymentUrl },
        lastError: null
      }
    });

    return NextResponse.json({
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.reference
    });
  } catch (error) {
    console.error("Paystack agent upgrade initialize error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize payment." },
      { status: 500 }
    );
  }
}
