import { randomUUID } from "node:crypto";
import { prisma } from "@/backend/lib/db/prisma";
import { resolvePriceForUser } from "@/backend/services/agentPricingService";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { toLocalGhanaPhone } from "@/backend/lib/utils/phoneFormatter";

export const AGENT_UPGRADE_FEE = 100;
export async function getPaystackSecret(): Promise<string> {
  const { paystack } = await getPaymentSettings();
  const secret = (paystack.secretKey || process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!secret) throw new Error("Save your Paystack secret key in Payment Settings first.");
  if (!secret.startsWith(paystack.mode === "Live" ? "sk_live_" : "sk_test_")) {
    throw new Error("Paystack key does not match the selected Test/Live mode.");
  }
  return secret;
}

export async function createPaystackCheckout(params: {
  request: Request; userId: string; amount: number; currency?: string; ref: string;
  type?: "order" | "wallet" | "agent_upgrade";
  networkId?: string; dataPlanId?: string; recipientNumber?: string;
  rewardToUse?: number; useWallet?: boolean; orderId?: string;
}) {
  const secret = await getPaystackSecret();
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user || user.status !== "ACTIVE") throw new Error("Active customer account required.");
  const type = params.type ?? "wallet";
  let amount = params.amount;
  let currency = "GHS";
  let recipientNumber = "";
  if (params.currency && params.currency !== "GHS") throw new Error("Only GHS payments are supported.");
  if (params.useWallet || (params.rewardToUse ?? 0) > 0) {
    throw new Error("Use the wallet checkout option to pay with wallet funds or rewards.");
  }
  if (type === "agent_upgrade") {
    if (user.role === "ADMIN" || user.role === "AGENT") throw new Error("Account is already an agent or admin.");
    amount = AGENT_UPGRADE_FEE;
  }
  if (type === "order") {
    if (!params.networkId || !params.dataPlanId || !params.recipientNumber) throw new Error("Select a network, package and recipient.");
    const plan = await prisma.dataPlan.findUnique({ where: { id: params.dataPlanId }, include: { network: true } });
    if (!plan?.isActive || !plan.network.isActive || plan.networkId !== params.networkId) throw new Error("Selected package is unavailable.");
    amount = await resolvePriceForUser(plan.price, user.id, plan.agentPrice);
    currency = plan.currency;
    recipientNumber = toLocalGhanaPhone(params.recipientNumber);
    if (!/^0\d{9}$/.test(recipientNumber)) throw new Error("Enter a valid Ghana recipient number.");
    if (params.orderId) {
      const order = await prisma.order.findUnique({ where: { id: params.orderId } });
      if (!order || order.userId !== user.id || order.paymentStatus !== "PENDING" || order.status !== "PENDING" ||
          order.dataPlanId !== plan.id || order.recipientNumber !== recipientNumber || order.paymentReference) {
        throw new Error("Order is not available for payment.");
      }
      amount = order.amount;
      currency = order.currency;
    }
  }
  amount = Math.round(amount * 100) / 100;
  if (currency !== "GHS" || !Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error("Invalid payment amount or currency.");
  // Never accept a client-supplied callback host or payment reference.
  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://vickydata.com").replace(/\/$/, "");
  const returnPath = type === "agent_upgrade" ? "/agent" : user.role === "ADMIN" ? "/admin" : user.role === "AGENT" ? "/agent" : "/dashboard";
  const reference = `PS-${randomUUID()}`;
  const metadata = { type, orderId: params.orderId ?? null, networkId: params.networkId ?? null,
    dataPlanId: params.dataPlanId ?? null, recipientNumber, returnPath };
  // Persist expected price/currency before Paystack can deliver a webhook.
  await prisma.paymentIntent.create({ data: {
    userId: user.id, provider: "PAYSTACK", type: type === "order" ? "ORDER" : "WALLET_TOPUP",
    status: "INITIATED", amount, currency, reference, clientReference: params.ref, metadata
  } });
  if (params.orderId) await prisma.order.update({ where: { id: params.orderId }, data: { paymentReference: reference } });
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.username) ? user.username : `${user.id}@customers.vickydata.com`;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, amount: Math.round(amount * 100), currency, reference,
      callback_url: `${base}/api/payments/paystack/verify-return`, metadata: { reference, type } }),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json();
  if (!response.ok || !result.status || !result.data?.authorization_url) throw new Error("Paystack could not open checkout. Check your saved credentials or try again.");
  const paymentUrl = String(result.data.authorization_url);
  if (new URL(paymentUrl).hostname !== "checkout.paystack.com" || !paymentUrl.startsWith("https://")) throw new Error("Unexpected checkout URL.");
  await prisma.paymentIntent.update({ where: { reference }, data: { rawInit: { authorizationUrl: paymentUrl } } });
  return { paymentUrl, reference, provider: "PAYSTACK" };
}
