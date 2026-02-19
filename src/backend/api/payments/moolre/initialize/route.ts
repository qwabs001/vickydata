import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/backend/lib/db/prisma";
import { resolveAppUrl } from "@/backend/lib/utils/appUrl";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { moolreService } from "@/backend/services/payments/moolreService";
import { resolvePriceForUser } from "@/backend/services/agentPricingService";

const bodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  ref: z.string().min(1),
  type: z.enum(["order", "wallet", "agent_upgrade"]).default("wallet"),
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let chargeAmount = amount;
    let chargeCurrency = currency ?? "GHS";

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
    }

    const baseUrl = resolveAppUrl(request);
    const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/payments/moolre/callback`;
    const returnPath = type === "agent_upgrade" ? "/agent" : getReturnPathForRole(user.role);
    const returnUrl = `${baseUrl.replace(/\/$/, "")}${returnPath}?payment=success`;

    const { moolre } = await getPaymentSettings();
    const pubKey = moolre.pubKey || process.env.MOOLRE_PUB_KEY || "";
    const accountNumber = moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "";

    const result = await moolreService.initiateHostedCheckout({
      amount: chargeAmount,
      currency: chargeCurrency,
      reference: ref,
      email: user.fullName || user.username || "",
      callbackUrl,
      returnUrl,
      accountNumber,
      credentials: pubKey ? { pubKey } : undefined
    });

    const intentMetadata = JSON.parse(JSON.stringify({
      clientRef: ref,
      type,
      intentKind: type === "agent_upgrade" ? "AGENT_UPGRADE" : type.toUpperCase(),
      networkId: parsed.data.networkId ?? null,
      dataPlanId: parsed.data.dataPlanId ?? null,
      recipientNumber: parsed.data.recipientNumber ?? null,
      rewardToUse: parsed.data.rewardToUse ?? 0,
      useWallet: parsed.data.useWallet ?? false,
      callbackUrl,
      returnUrl,
      createdAt: new Date().toISOString()
    }));

    await prisma.paymentIntent.upsert({
      where: { reference: result.reference },
      create: {
        userId,
        provider: "MOOLRE",
        type: type === "order" ? "ORDER" : "WALLET_TOPUP",
        status: "INITIATED",
        amount: chargeAmount,
        currency: chargeCurrency,
        reference: result.reference,
        clientReference: ref,
        metadata: intentMetadata,
        rawInit: { authorizationUrl: result.authorizationUrl }
      },
      update: {
        status: "INITIATED",
        amount: chargeAmount,
        currency: chargeCurrency,
        clientReference: ref,
        metadata: intentMetadata,
        rawInit: { authorizationUrl: result.authorizationUrl },
        lastError: null
      }
    });

    // Store pending payment details so the callback can create the order/add funds
    const pendingValue = JSON.parse(JSON.stringify({
      userId,
      amount: chargeAmount,
      currency: chargeCurrency,
      type,
      ref: result.reference,
      networkId: parsed.data.networkId ?? null,
      dataPlanId: parsed.data.dataPlanId ?? null,
      recipientNumber: parsed.data.recipientNumber ?? null,
      rewardToUse: parsed.data.rewardToUse ?? 0,
      useWallet: parsed.data.useWallet ?? false,
      createdAt: new Date().toISOString()
    }));

    await prisma.settings.upsert({
      where: { key: `pending_payment.${result.reference}` },
      create: {
        key: `pending_payment.${result.reference}`,
        value: pendingValue,
        category: "pending_payment"
      },
      update: {
        value: pendingValue
      }
    });

    if (ref !== result.reference) {
      await prisma.settings.upsert({
        where: { key: `pending_payment.${ref}` },
        create: {
          key: `pending_payment.${ref}`,
          value: pendingValue,
          category: "pending_payment"
        },
        update: {
          value: pendingValue
        }
      });
    }

    return NextResponse.json({
      paymentUrl: result.authorizationUrl,
      reference: result.reference
    });
  } catch (error) {
    const err = error as Error;
    const message = err.message ?? "Unable to initialize payment.";
    console.error("[Moolre initialize]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
