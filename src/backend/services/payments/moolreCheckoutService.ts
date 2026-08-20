import { prisma } from "@/backend/lib/db/prisma";
import { resolveAppUrl } from "@/backend/lib/utils/appUrl";
import { resolvePriceForUser } from "@/backend/services/agentPricingService";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { moolreService } from "@/backend/services/payments/moolreService";

export type MoolreCheckoutType = "order" | "wallet" | "agent_upgrade";

type CreateMoolreCheckoutParams = {
  request: Request;
  userId: string;
  amount: number;
  currency?: string;
  ref: string;
  type?: MoolreCheckoutType;
  networkId?: string;
  dataPlanId?: string;
  recipientNumber?: string;
  rewardToUse?: number;
  useWallet?: boolean;
  orderId?: string | null;
};

type MoolreCheckoutResult = {
  paymentUrl: string;
  reference: string;
};

function checkoutError(message: string, statusCode: number): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function getReturnPathForRole(role?: string | null, type?: MoolreCheckoutType): string {
  if (type === "agent_upgrade") return "/agent";
  if (role === "ADMIN") return "/admin";
  if (role === "AGENT") return "/agent";
  return "/dashboard";
}

export async function createMoolreCheckout(
  params: CreateMoolreCheckoutParams
): Promise<MoolreCheckoutResult> {
  const {
    request,
    userId,
    amount,
    currency = "GHS",
    ref,
    type = "wallet",
    networkId,
    dataPlanId,
    recipientNumber,
    rewardToUse,
    useWallet,
    orderId
  } = params;

  if (type === "order" && (!networkId || !dataPlanId || !recipientNumber) && !orderId) {
    throw checkoutError("Order payment requires networkId, dataPlanId, and recipientNumber.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") {
    throw checkoutError("Unauthorized.", 401);
  }

  if (type === "agent_upgrade" && (user.role === "AGENT" || user.role === "ADMIN")) {
    throw checkoutError("User is already an agent or admin.", 400);
  }

  let chargeAmount = amount;
  let chargeCurrency = currency;

  if (type === "order" && dataPlanId) {
    const selectedPlan = await prisma.dataPlan.findUnique({
      where: { id: dataPlanId },
      select: { price: true, agentPrice: true, currency: true, networkId: true }
    });

    if (!selectedPlan) {
      throw checkoutError("Data plan not found.", 404);
    }

    if (networkId && selectedPlan.networkId !== networkId) {
      throw checkoutError("Data plan does not match selected network.", 400);
    }

    chargeAmount = await resolvePriceForUser(selectedPlan.price, userId, selectedPlan.agentPrice);
    chargeCurrency = selectedPlan.currency ?? chargeCurrency;
  }

  const baseUrl = resolveAppUrl(request);
  const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/payments/moolre/callback`;
  const returnPath = getReturnPathForRole(user.role, type);
  const returnUrl = `${baseUrl.replace(/\/$/, "")}${returnPath}?payment=success`;

  const { moolre } = await getPaymentSettings();
  const pubKey = moolre.pubKey || process.env.MOOLRE_PUB_KEY || "";
  const accountNumber = moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "";

  const result = await moolreService.initiateHostedCheckout({
    amount: chargeAmount,
    currency: chargeCurrency,
    reference: ref,
    email: user.fullName || user.username || user.phoneNumber || "",
    callbackUrl,
    returnUrl,
    accountNumber,
    credentials: pubKey ? { pubKey } : undefined
  });

  const intentMetadata = JSON.parse(JSON.stringify({
    clientRef: ref,
    type,
    intentKind: type === "agent_upgrade" ? "AGENT_UPGRADE" : type.toUpperCase(),
    networkId: networkId ?? null,
    dataPlanId: dataPlanId ?? null,
    recipientNumber: recipientNumber ?? null,
    rewardToUse: rewardToUse ?? 0,
    useWallet: useWallet ?? false,
    orderId: orderId ?? null,
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

  const pendingValue = JSON.parse(JSON.stringify({
    userId,
    amount: chargeAmount,
    currency: chargeCurrency,
    type,
    ref: result.reference,
    networkId: networkId ?? null,
    dataPlanId: dataPlanId ?? null,
    recipientNumber: recipientNumber ?? null,
    rewardToUse: rewardToUse ?? 0,
    useWallet: useWallet ?? false,
    orderId: orderId ?? null,
    createdAt: new Date().toISOString()
  }));

  await prisma.settings.upsert({
    where: { key: `pending_payment.${result.reference}` },
    create: {
      key: `pending_payment.${result.reference}`,
      value: pendingValue,
      category: "pending_payment"
    },
    update: { value: pendingValue }
  });

  if (ref !== result.reference) {
    await prisma.settings.upsert({
      where: { key: `pending_payment.${ref}` },
      create: {
        key: `pending_payment.${ref}`,
        value: pendingValue,
        category: "pending_payment"
      },
      update: { value: pendingValue }
    });
  }

  return {
    paymentUrl: result.authorizationUrl,
    reference: result.reference
  };
}
