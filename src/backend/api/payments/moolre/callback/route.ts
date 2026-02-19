import { NextResponse, NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/backend/lib/db/prisma";
import { resolveAppUrl } from "@/backend/lib/utils/appUrl";
import { getPaymentSettings } from "@/backend/services/paymentSettingsService";
import { moolreService } from "@/backend/services/payments/moolreService";
import { orderService } from "@/backend/services/orders/orderService";

/**
 * Moolre callback — called when the user completes (or cancels) payment.
 *
 * 1. Verify the payment with Moolre
 * 2. Look up the pending payment record
 * 3. Create the order (for type: "order") or add wallet funds (for type: "wallet")
 * 4. Delete the pending payment record
 * 5. Redirect user to dashboard
 */

type PendingPayment = {
  userId: string;
  amount: number;
  currency: string;
  type: "order" | "wallet" | "agent_upgrade";
  ref: string;
  networkId: string | null;
  dataPlanId: string | null;
  recipientNumber: string | null;
  rewardToUse: number;
  useWallet: boolean;
};

type IntentMetadata = {
  intentKind?: string | null;
  networkId?: string | null;
  dataPlanId?: string | null;
  recipientNumber?: string | null;
  rewardToUse?: number;
  useWallet?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeMap(entries: Iterable<[string, string]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    out[key] = value;
  }
  return out;
}

function parseJsonLike(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function amountsMatch(expected: number, got: number): boolean {
  const e = roundMoney(expected);
  const g = roundMoney(got);
  if (e === g) return true;
  // Some providers return amount in base units (x100) or major units (/100)
  if (roundMoney(g / 100) === e) return true;
  if (roundMoney(g * 100) === e) return true;
  return false;
}

function statusLooksSuccessful(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "success", "successful", "completed", "confirmed", "approved", "p01"].includes(normalized);
  }
  return false;
}

function callbackPayloadLooksConfirmed(params: {
  candidates: Record<string, unknown>[];
  expectedReference: string;
  expectedAmount: number;
  expectedSecret?: string;
}): boolean {
  const { candidates, expectedReference, expectedAmount, expectedSecret } = params;
  const expectedSecretValue = expectedSecret?.trim() || "";

  for (const candidate of candidates) {
    const reference = [
      candidate.externalref,
      candidate.external_ref,
      candidate.externalRef,
      candidate.reference,
      candidate.ref,
      candidate.transaction_ref,
      candidate.txn_ref
    ].find((value) => typeof value === "string" && value.trim().length > 0) as string | undefined;

    if (!reference || reference.trim() !== expectedReference) continue;

    const amount =
      parseAmount(candidate.amount) ??
      parseAmount(candidate.value) ??
      parseAmount(candidate.amount_paid) ??
      parseAmount(candidate.paid_amount);
    if (amount == null || !amountsMatch(expectedAmount, amount)) continue;

    if (expectedSecretValue.length > 0) {
      const secret =
        (typeof candidate.secret === "string" ? candidate.secret.trim() : "") ||
        (typeof candidate.secretKey === "string" ? candidate.secretKey.trim() : "");
      if (secret !== expectedSecretValue) continue;
    }

    const success =
      statusLooksSuccessful(candidate.txstatus) ||
      statusLooksSuccessful(candidate.status) ||
      statusLooksSuccessful(candidate.code) ||
      statusLooksSuccessful(candidate.payment_status) ||
      (typeof candidate.message === "string" && candidate.message.toLowerCase().includes("success"));

    if (success) return true;
  }

  return false;
}

function buildCandidates(payload: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!payload) return [];
  const candidates: Record<string, unknown>[] = [payload];
  for (const key of ["data", "transaction", "payment", "response", "result"]) {
    const value = payload[key];
    if (isRecord(value)) {
      candidates.push(value);
    } else if (typeof value === "string" && value.trim().startsWith("{")) {
      const parsed = parseJsonLike(value);
      if (parsed) candidates.push(parsed);
    }
  }
  return candidates;
}

function findReference(candidates: Record<string, unknown>[]): string | null {
  const keys = [
    "reference",
    "ref",
    "transaction_ref",
    "transactionRef",
    "txn_ref",
    "txnRef",
    "trans_ref",
    "transRef",
    "externalref",
    "external_ref",
    "externalRef",
    "externalreference",
    "externalReference",
    "thirdpartyref",
    "thirdparty_ref",
    "thirdPartyRef"
  ];
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return null;
}

function shouldRespondWithJson(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const userAgent = (request.headers.get("user-agent") ?? "").toLowerCase();
  const secFetchDest = (request.headers.get("sec-fetch-dest") ?? "").toLowerCase();
  const secFetchMode = (request.headers.get("sec-fetch-mode") ?? "").toLowerCase();
  const hasBrowserHints =
    accept.includes("text/html") ||
    secFetchDest === "document" ||
    secFetchMode === "navigate" ||
    userAgent.includes("mozilla");

  if (hasBrowserHints) return false;
  return true;
}

function respond(
  request: NextRequest,
  redirectUrl: string,
  body: Record<string, unknown>,
  status: number = 200
) {
  const json = shouldRespondWithJson(request);
  console.log("[Moolre callback] response mode", {
    method: request.method,
    accept: request.headers.get("accept"),
    userAgent: request.headers.get("user-agent"),
    secFetchDest: request.headers.get("sec-fetch-dest"),
    secFetchMode: request.headers.get("sec-fetch-mode"),
    referer: request.headers.get("referer"),
    json
  });

  if (json) {
    return NextResponse.json({ ...body, redirect: redirectUrl }, { status });
  }
  return NextResponse.redirect(redirectUrl);
}

async function readPayload(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (request.method === "GET") return null;
  const raw = await request.text().catch(() => "");
  if (!raw.trim()) return null;

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/json")) {
    return parseJsonLike(raw);
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const parsed = normalizeMap(new URLSearchParams(raw).entries());
    const dataField = parsed.data;
    if (typeof dataField === "string" && dataField.trim().startsWith("{")) {
      const nested = parseJsonLike(dataField);
      if (nested) parsed.data = nested;
    }
    return parsed;
  }

  return parseJsonLike(raw) ?? normalizeMap(new URLSearchParams(raw).entries());
}

function pendingFromIntent(intent: {
  userId: string;
  amount: number;
  currency: string;
  type: "ORDER" | "WALLET_TOPUP";
  reference: string;
  metadata: unknown;
}): PendingPayment {
  const meta = (intent.metadata ?? {}) as IntentMetadata;
  const intentKind = (meta.intentKind ?? "").toString().toUpperCase();
  const pendingType =
    intent.type === "ORDER"
      ? "order"
      : intentKind === "AGENT_UPGRADE"
        ? "agent_upgrade"
        : "wallet";
  return {
    userId: intent.userId,
    amount: intent.amount,
    currency: intent.currency,
    type: pendingType,
    ref: intent.reference,
    networkId: meta.networkId ?? null,
    dataPlanId: meta.dataPlanId ?? null,
    recipientNumber: meta.recipientNumber ?? null,
    rewardToUse: meta.rewardToUse ?? 0,
    useWallet: meta.useWallet ?? false
  };
}

async function handleCallback(request: NextRequest) {
  const url = new URL(request.url);
  const queryPayload = normalizeMap(url.searchParams.entries());
  const bodyPayload = await readPayload(request);
  const callbackCandidates = [
    queryPayload,
    ...buildCandidates(bodyPayload)
  ];
  const reference = findReference(callbackCandidates);

  const appUrl = resolveAppUrl(request);

  let successUrl = `${appUrl}/dashboard?payment=success`;
  let failedUrl = `${appUrl}/dashboard?payment=failed`;
  let errorUrl = `${appUrl}/dashboard?payment=error`;
  let unknownUrl = `${appUrl}/dashboard?payment=unknown`;

  if (!reference) {
    console.warn(
      "[Moolre callback] No reference in callback payload.",
      { queryPayload, bodyPayload }
    );
    return respond(
      request,
      unknownUrl,
      { ok: false, received: true, error: "missing_reference" },
      200
    );
  }

  try {
    // 1. Look up payment intent (preferred) or legacy pending settings
    let paymentIntent = await prisma.paymentIntent.findFirst({
      where: {
        provider: "MOOLRE",
        OR: [{ reference }, { clientReference: reference }]
      }
    });

    let pendingRecord: { key: string; value: unknown } | null = null;
    let pending: PendingPayment | null = null;

    if (paymentIntent) {
      pending = pendingFromIntent({
        userId: paymentIntent.userId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        type: paymentIntent.type,
        reference: paymentIntent.reference,
        metadata: paymentIntent.metadata
      });
    } else {
      let legacyRecord = await prisma.settings.findUnique({
        where: { key: `pending_payment.${reference}` }
      });

      // If not found, try searching all pending payments for this reference
      if (!legacyRecord) {
        console.log("[Moolre callback] No exact match for ref:", reference, "— searching all pending...");
        const allPending = await prisma.settings.findMany({
          where: { category: "pending_payment" }
        });
        for (const record of allPending) {
          const val = record.value as unknown as PendingPayment;
          if (val?.ref === reference) {
            legacyRecord = record;
            break;
          }
        }
      }

      if (legacyRecord) {
        pendingRecord = { key: legacyRecord.key, value: legacyRecord.value };
        pending = legacyRecord.value as unknown as PendingPayment;
      }
    }

    if (!pending) {
      console.warn("[Moolre callback] No pending payment found for:", reference);
      return respond(
        request,
        successUrl,
        { ok: true, received: true, status: "pending_not_found", reference },
        200
      );
    }

    const userForRedirect = await prisma.user.findUnique({
      where: { id: pending.userId },
      select: { role: true }
    });
    const basePath =
      userForRedirect?.role === "ADMIN"
        ? "/admin"
        : userForRedirect?.role === "AGENT"
          ? "/agent"
          : "/dashboard";
    if (pending.type === "agent_upgrade") {
      successUrl = `${appUrl}/agent?payment=success`;
      failedUrl = `${appUrl}/dashboard?payment=failed`;
      errorUrl = `${appUrl}/dashboard?payment=error`;
      unknownUrl = `${appUrl}/dashboard?payment=unknown`;
    } else {
      successUrl = `${appUrl}${basePath}?payment=success`;
      failedUrl = `${appUrl}${basePath}?payment=failed`;
      errorUrl = `${appUrl}${basePath}?payment=error`;
      unknownUrl = `${appUrl}${basePath}?payment=unknown`;
    }

    console.log("[Moolre callback] Found pending payment:", pending.type, "userId:", pending.userId, "amount:", pending.amount);

    // 2. Verify payment with Moolre — MUST succeed before crediting
    let verifiedRef = reference;
    let verificationData: Record<string, unknown> | null = null;
    let verificationJson: Prisma.InputJsonValue | undefined;
    try {
      const { moolre } = await getPaymentSettings();
      const pubKey = moolre.pubKey || process.env.MOOLRE_PUB_KEY || "";
      const accountNumber = moolre.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER || "";
      const secretKey = (moolre.secretKey || process.env.MOOLRE_SECRET_KEY || "").trim();

      const candidates = Array.from(
        new Set(
          [
            reference,
            pending.ref,
            paymentIntent?.reference,
            paymentIntent?.clientReference
          ].filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );
      let lastError: unknown = null;
      let confirmed = false;
      let verification: Awaited<ReturnType<typeof moolreService.verifyPayment>> | null = null;
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts && !confirmed; attempt += 1) {
        for (const candidate of candidates) {
          try {
            verification = await moolreService.verifyPayment({
              reference: candidate,
              accountNumber,
              credentials: pubKey ? { pubKey } : undefined,
              expectedAmount: pending.amount,
              expectedCurrency: pending.currency,
              expectedReferences: candidates
            });
            if (verification?.status && verification.confirmed) {
              confirmed = true;
              verifiedRef = candidate;
              verificationData = (verification.data as Record<string, unknown>) ?? null;
              if (verificationData) {
                verificationJson = JSON.parse(JSON.stringify(verificationData)) as Prisma.InputJsonValue;
              }
              break;
            }
            lastError = verification?.reasons ?? ["not_confirmed"];
          } catch (err) {
            lastError = err;
          }
        }
        if (!confirmed && attempt < maxAttempts) {
          await sleep(1200);
        }
      }

      if (
        !confirmed &&
        callbackPayloadLooksConfirmed({
          candidates: callbackCandidates,
          expectedReference: reference,
          expectedAmount: pending.amount,
          expectedSecret: secretKey
        })
      ) {
        confirmed = true;
        verifiedRef = reference;
        verificationData = bodyPayload;
        if (verificationData) {
          verificationJson = JSON.parse(JSON.stringify(verificationData)) as Prisma.InputJsonValue;
        }
      }

      if (!confirmed) {
        if (paymentIntent) {
          await prisma.paymentIntent.update({
            where: { id: paymentIntent.id },
            data: {
              status: "PENDING",
              lastError: Array.isArray(lastError)
                ? lastError.join(", ")
                : lastError instanceof Error
                  ? lastError.message
                  : "not_confirmed"
            }
          }).catch(() => {});
        }
        console.warn(
          "[Moolre callback] Verification not confirmed:",
          reference,
          lastError ?? []
        );
        return respond(
          request,
          failedUrl,
          { ok: false, received: true, error: "payment_not_confirmed", reference },
          200
        );
      }
      console.log("[Moolre callback] Payment verified:", verifiedRef);
    } catch (verifyErr) {
      if (paymentIntent) {
        await prisma.paymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: "FAILED",
            lastError: verifyErr instanceof Error ? verifyErr.message : "verification_error"
          }
        }).catch(() => {});
      }
      // Payment cancelled, failed, or not yet confirmed — do NOT credit
      console.warn("[Moolre callback] Verification failed (payment not confirmed):", verifyErr instanceof Error ? verifyErr.message : verifyErr);
      return respond(
        request,
        failedUrl,
        { ok: false, received: true, error: "verification_error", reference },
        200
      );
    }

    // 3. Process based on type (only reached when verification succeeded)
    if (pending.type === "order") {
      if (!pending.networkId || !pending.dataPlanId || !pending.recipientNumber) {
        console.error("[Moolre callback] Missing order fields for:", reference);
        return respond(
          request,
          errorUrl,
          { ok: false, received: true, error: "invalid_pending_order", reference },
          400
        );
      }

      let orderId: string | null = null;
      let shouldCreateOrder = true;
      if (paymentIntent) {
        const locked = await prisma.paymentIntent.updateMany({
          where: { id: paymentIntent.id, status: { not: "CONFIRMED" } },
          data: { status: "PENDING", lastError: null }
        });
        if (locked.count === 0) {
          console.log("[Moolre callback] Order already processed for intent:", paymentIntent.id);
          shouldCreateOrder = false;
        }
      }

      if (!paymentIntent || shouldCreateOrder) {
        const order = await orderService.createOrder({
          userId: pending.userId,
          networkId: pending.networkId,
          dataPlanId: pending.dataPlanId,
          recipientNumber: pending.recipientNumber,
          amount: pending.amount,
          currency: pending.currency,
          rewardToUse: pending.rewardToUse,
          useWallet: false
        });
        orderId = order.id;

        // Mark payment as confirmed — do NOT set status to COMPLETED yet.
        // fulfillOrder() keeps order in PROCESSING until provider confirms completion.
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "PROCESSING",
            paymentStatus: "COMPLETED",
            paymentMethod: "MOOLRE",
            paymentReference: pending.ref ?? verifiedRef
          }
        });

        if (paymentIntent) {
          await prisma.paymentIntent.update({
            where: { id: paymentIntent.id },
            data: {
              status: "CONFIRMED",
              verifiedAt: new Date(),
              rawVerify: verificationJson,
              lastError: null
            }
          }).catch(() => {});
        }
      }

      if (orderId) {
        // Fulfill the order (send data to provider API)
        try {
          const { dataProviderService } = await import(
            "@/backend/services/dataProvider/dataProviderService"
          );
          const fulfillResult = await dataProviderService.fulfillOrder(orderId);
          console.log("[Moolre callback] Fulfillment result:", fulfillResult);
          if (!fulfillResult.ok) {
            console.error("[Moolre callback] Fulfillment failed:", fulfillResult.error);
          }
        } catch (err) {
          console.error("[Moolre callback] Order fulfillment error:", err);
        }
      }

      console.log("[Moolre callback] Order processed:", orderId ?? "already processed");
    } else if (pending.type === "wallet") {
      let walletCredited = false;
      let newBalance = 0;
      await prisma.$transaction(async (tx) => {
        if (paymentIntent) {
          const updated = await tx.paymentIntent.updateMany({
            where: { id: paymentIntent.id, status: { not: "CONFIRMED" } },
            data: {
              status: "CONFIRMED",
              verifiedAt: new Date(),
              rawVerify: verificationJson,
              lastError: null
            }
          });
          if (updated.count === 0) {
            return;
          }
        }

        // Add funds to wallet
        const wallet = await tx.walletBalance.findUnique({
          where: { userId: pending.userId }
        });
        const before = wallet?.currentBalance ?? 0;
        newBalance = Math.round((before + pending.amount) * 100) / 100;

        await tx.walletBalance.upsert({
          where: { userId: pending.userId },
          create: {
            userId: pending.userId,
            totalAdded: pending.amount,
            totalSpent: 0,
            currentBalance: newBalance
          },
          update: {
            totalAdded: { increment: pending.amount },
            currentBalance: { increment: pending.amount }
          }
        });

        await tx.walletTransaction.create({
          data: {
            userId: pending.userId,
            type: "ADDED",
            amount: pending.amount,
            balanceBefore: before,
            balanceAfter: newBalance,
            description: `Added via Moolre (${pending.ref ?? verifiedRef})`
          }
        });
        walletCredited = true;
      });

      console.log("[Moolre callback] Wallet funded:", pending.userId, pending.amount, "credited:", walletCredited);

      if (walletCredited && newBalance > 0) {
        try {
          const { sendWalletTopUpSms } = await import("@/backend/services/smsNotifications");
          await sendWalletTopUpSms(pending.userId, pending.amount, newBalance);
        } catch (smsErr) {
          console.error("[Moolre callback] Wallet top-up SMS error:", smsErr);
        }
      }
    } else if (pending.type === "agent_upgrade") {
      let upgraded = false;
      await prisma.$transaction(async (tx) => {
        if (paymentIntent) {
          const updated = await tx.paymentIntent.updateMany({
            where: { id: paymentIntent.id, status: { not: "CONFIRMED" } },
            data: {
              status: "CONFIRMED",
              verifiedAt: new Date(),
              rawVerify: verificationJson,
              lastError: null
            }
          });
          if (updated.count === 0) {
            return;
          }
        }

        await tx.user.update({
          where: { id: pending.userId },
          data: { role: "AGENT" }
        });
        upgraded = true;
      });

      if (upgraded) {
        successUrl = `${appUrl}/agent?payment=success`;
      }
      console.log("[Moolre callback] Agent upgrade processed:", pending.userId, "upgraded:", upgraded);
    }

    // 4. Clean up pending payment (use record key — ref in URL may differ from stored key)
    if (pendingRecord) {
      await prisma.settings.delete({
        where: { key: pendingRecord.key }
      }).catch(() => {});
    }

    return respond(
      request,
      successUrl,
      { ok: true, received: true, status: "confirmed", reference: verifiedRef },
      200
    );
  } catch (error) {
    console.error("[Moolre callback] Error:", reference, error);
    return respond(
      request,
      failedUrl,
      { ok: false, received: true, error: "callback_processing_error", reference },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}
