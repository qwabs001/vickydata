/**
 * Moolre Payment Service
 *
 * Two integration modes:
 * 1. Hosted Checkout (embed/src/start) — returns an authorization_url
 *    where the user enters their MoMo number and approves payment.
 * 2. Direct MoMo Prompt (open/transact/payment) — sends a payment prompt
 *    directly to the user's phone (requires payer number upfront).
 *
 * We default to Hosted Checkout so users are redirected to the Moolre
 * payment page (pos.moolre.com).
 */

const MOOLRE_API = "https://api.moolre.com";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MoolreInitParams = {
  amount: number;
  currency?: string;
  reference?: string;
  email?: string;
  callbackUrl?: string;
  returnUrl?: string;
  accountNumber: string;
  credentials?: { apiUser?: string; pubKey: string };
};

export type MoolreInitResult = {
  authorizationUrl: string;
  reference: string;
};

export type MoolreVerifyParams = {
  reference: string;
  accountNumber: string;
  credentials?: { pubKey: string };
  expectedAmount?: number;
  expectedCurrency?: string;
  expectedReferences?: string[];
};

export type MoolreVerifyResult = {
  status: boolean;
  confirmed: boolean;
  message: string;
  data: Record<string, unknown>;
  reasons?: string[];
};

/* ------------------------------------------------------------------ */
/*  Direct MoMo prompt types (kept for order payments if needed)       */
/* ------------------------------------------------------------------ */

export type MoolreDirectParams = {
  amount: number;
  currency?: string;
  payer: string;
  externalRef: string;
  accountNumber: string;
  channel?: string;
  callbackUrl?: string;
  credentials?: { apiUser: string; pubKey: string };
};

export type MoolreDirectResult =
  | { status: "otp_required"; message: string }
  | { status: "pending"; message: string }
  | { status: "success"; data: Record<string, unknown> };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMessage(msg: string | string[] | undefined): string {
  if (Array.isArray(msg)) return msg.join(", ");
  return typeof msg === "string" ? msg : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value === "boolean") return value ? "success" : "failed";
  if (typeof value === "number") return value === 1 ? "success" : value === 0 ? "failed" : String(value);
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) return null;
  if (normalized === "1" || normalized === "true") return "success";
  if (normalized === "0" || normalized === "false") return "failed";
  return normalized;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "paid", "success", "successful", "completed", "confirmed", "approved", "1"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "failed", "failure", "pending", "processing", "cancelled", "canceled", "declined", "0"].includes(normalized)) {
    return false;
  }
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "");
    const match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number.parseFloat(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function collectCandidates(data: Record<string, unknown>): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = [data];
  for (const key of ["data", "transaction", "payment", "tx", "response", "result"]) {
    const nested = data[key];
    if (isRecord(nested)) candidates.push(nested);
  }
  return candidates;
}

function findFirstValue(candidates: Record<string, unknown>[], keys: string[]): unknown {
  for (const candidate of candidates) {
    for (const key of keys) {
      if (candidate[key] != null) return candidate[key];
    }
  }
  return undefined;
}

function checkConfirmation(
  data: Record<string, unknown>,
  params: Pick<MoolreVerifyParams, "expectedAmount" | "expectedCurrency" | "expectedReferences">,
  message?: string
): { confirmed: boolean; reasons: string[] } {
  const candidates = collectCandidates(data);
  const reasons: string[] = [];
  let confirmed = true;
  let evidenceFound = false;

  const statusValue = findFirstValue(candidates, [
    "payment_status",
    "paymentStatus",
    "transaction_status",
    "transactionStatus",
    "tx_status",
    "txStatus",
    "status",
    "state",
    "result"
  ]);
  if (statusValue !== undefined) {
    evidenceFound = true;
    const normalized = normalizeStatus(statusValue);
    if (!normalized) {
      confirmed = false;
      reasons.push("status_unreadable");
    } else if (["success", "successful", "paid", "completed", "confirmed", "approved", "ok", "done"].includes(normalized)) {
      // ok
    } else {
      confirmed = false;
      reasons.push(`status_${normalized}`);
    }
  }

  const paidValue = findFirstValue(candidates, [
    "paid",
    "is_paid",
    "isPaid",
    "payment_confirmed",
    "paymentConfirmed",
    "confirmed",
    "is_confirmed",
    "isConfirmed",
    "paid_status",
    "paidStatus"
  ]);
  if (paidValue !== undefined) {
    evidenceFound = true;
    const paid = normalizeBoolean(paidValue);
    if (paid === false) {
      confirmed = false;
      reasons.push("paid_false");
    } else if (paid === null) {
      confirmed = false;
      reasons.push("paid_unreadable");
    }
  }

  if (params.expectedAmount != null) {
    const amountValue = findFirstValue(candidates, [
      "amount",
      "amount_paid",
      "amountPaid",
      "paid_amount",
      "paidAmount",
      "amount_received",
      "amountReceived",
      "value",
      "value_paid",
      "valuePaid"
    ]);
    if (amountValue !== undefined) {
      evidenceFound = true;
      const parsed = parseAmount(amountValue);
      if (parsed == null) {
        confirmed = false;
        reasons.push("amount_unreadable");
      } else if (roundMoney(parsed) !== roundMoney(params.expectedAmount)) {
        confirmed = false;
        reasons.push(`amount_mismatch:${roundMoney(parsed)}`);
      }
    }
  }

  if (params.expectedCurrency) {
    const currencyValue = findFirstValue(candidates, [
      "currency",
      "currency_code",
      "currencyCode"
    ]);
    if (currencyValue !== undefined) {
      evidenceFound = true;
      const normalized = typeof currencyValue === "string" ? currencyValue.trim().toUpperCase() : "";
      if (!normalized) {
        confirmed = false;
        reasons.push("currency_unreadable");
      } else if (normalized !== params.expectedCurrency.trim().toUpperCase()) {
        confirmed = false;
        reasons.push(`currency_mismatch:${normalized}`);
      }
    }
  }

  if (params.expectedReferences?.length) {
    const referenceValue = findFirstValue(candidates, [
      "reference",
      "ref",
      "transaction_ref",
      "transactionRef",
      "txn_ref",
      "txnRef",
      "trans_ref",
      "transRef",
      "external_ref",
      "externalRef",
      "externalref"
    ]);
    if (referenceValue !== undefined) {
      evidenceFound = true;
      const normalized = typeof referenceValue === "string" ? referenceValue.trim() : "";
      if (!normalized) {
        confirmed = false;
        reasons.push("reference_unreadable");
      } else if (!params.expectedReferences.includes(normalized)) {
        confirmed = false;
        reasons.push("reference_mismatch");
      }
    }
  }

  if (!evidenceFound && message) {
    const normalized = message.trim().toLowerCase();
    if (normalized) {
      evidenceFound = true;
      if (["success", "successful", "paid", "completed", "confirmed", "approved"].some((term) => normalized.includes(term))) {
        confirmed = true;
      } else if (["pending", "processing", "failed", "failure", "cancelled", "canceled", "declined"].some((term) => normalized.includes(term))) {
        confirmed = false;
        reasons.push("message_indicates_failure");
      } else {
        confirmed = false;
        reasons.push("message_unreadable");
      }
    }
  }

  if (!evidenceFound) {
    return { confirmed: false, reasons: ["no_confirmation_evidence"] };
  }

  return { confirmed, reasons };
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

export const moolreService = {
  /**
   * Hosted Checkout — creates a payment session and returns an
   * authorization_url (pos.moolre.com) for the user to complete payment.
   */
  async initiateHostedCheckout(params: MoolreInitParams): Promise<MoolreInitResult> {
    const pubKey = params.credentials?.pubKey ?? process.env.MOOLRE_PUB_KEY;
    const accountNumber = params.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER;

    if (!pubKey || !accountNumber) {
      throw new Error(
        "Moolre credentials missing. Configure them in Admin → Payment Settings or set MOOLRE_PUB_KEY, MOOLRE_ACCOUNT_NUMBER."
      );
    }

    const reference = params.reference ?? `moolre_${Date.now()}`;

    const callbackUrl = params.callbackUrl ?? "";
    const returnUrl = params.returnUrl ?? callbackUrl;
    const body: Record<string, unknown> = {
      state: "starter",
      accountnumber: accountNumber,
      reference,
      email: params.email ?? "",
      amount: params.amount,
      currency: params.currency ?? "GHS",
      callback: callbackUrl,
      callbackurl: callbackUrl,
      callbackUrl: callbackUrl,
      tx_source: "web-sdk"
    };
    if (returnUrl) {
      // Some Moolre integrations use "go" as the hosted-page browser return target.
      body.go = returnUrl;
      body.go_url = returnUrl;
      body.gourl = returnUrl;
      body.return_url = returnUrl;
      body.returnurl = returnUrl;
      body.returnUrl = returnUrl;
      body.success_url = returnUrl;
      body.successurl = returnUrl;
      body.successUrl = returnUrl;
      body.redirect_url = returnUrl;
      body.redirecturl = returnUrl;
      body.redirectUrl = returnUrl;
    }

    const response = await fetch(`${MOOLRE_API}/embed/src/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Pubkey": pubKey
      },
      body: JSON.stringify(body)
    });

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    const status = json?.status;
    const message = formatMessage(json?.message as string | string[] | undefined);
    const data = json?.data as Record<string, unknown> | undefined;
    const authorizationUrl = data?.authorization_url as string | undefined;

    if ((status !== true && status !== 1) && !authorizationUrl) {
      throw new Error(message || "Payment initiation failed. Check your Moolre credentials.");
    }

    if (!authorizationUrl) {
      throw new Error("Moolre did not return a checkout URL. Check your Moolre dashboard.");
    }

    return {
      authorizationUrl,
      reference: (data?.reference as string) ?? reference
    };
  },

  /**
   * Verify a payment by reference.
   */
  async verifyPayment(params: MoolreVerifyParams): Promise<MoolreVerifyResult> {
    const pubKey = params.credentials?.pubKey ?? process.env.MOOLRE_PUB_KEY;
    const accountNumber = params.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER;

    if (!pubKey || !accountNumber) {
      throw new Error("Moolre credentials missing for verification.");
    }

    const body = {
      state: "confirm",
      accountnumber: accountNumber,
      reference: params.reference
    };

    const response = await fetch(`${MOOLRE_API}/embed/src/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Pubkey": pubKey
      },
      body: JSON.stringify(body)
    });

    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const statusValue = json?.status;
    const normalizedStatus = normalizeStatus(statusValue);
    const okStatuses = new Set(["success", "successful", "ok", "true"]);
    const isOk = response.ok && normalizedStatus != null && okStatuses.has(normalizedStatus);

    if (!isOk) {
      const msg = formatMessage(json?.message as string | string[] | undefined);
      const statusLabel = normalizedStatus ?? String(statusValue ?? "unknown");
      throw new Error(msg || `Payment verification failed (status: ${statusLabel}).`);
    }

    const data = (json?.data as Record<string, unknown>) ?? {};
    const message = formatMessage(json?.message as string | string[] | undefined);
    const expectedReferences = [params.reference, ...(params.expectedReferences ?? [])].filter(Boolean);
    const confirmation = checkConfirmation(data, {
      expectedAmount: params.expectedAmount,
      expectedCurrency: params.expectedCurrency,
      expectedReferences
    }, message);

    return {
      status: true,
      confirmed: confirmation.confirmed,
      message: message || "Payment verified.",
      data,
      reasons: confirmation.reasons
    };
  },

  /**
   * Direct MoMo Prompt — sends a payment request directly to the user's
   * phone. Use this for order payments where the payer number is known.
   */
  async initiateDirectPayment(params: MoolreDirectParams): Promise<MoolreDirectResult> {
    const apiUser =
      params.credentials?.apiUser ?? process.env.MOOLRE_API_USER ?? process.env.MOOLRE_USER;
    const pubKey = params.credentials?.pubKey ?? process.env.MOOLRE_PUB_KEY;
    const accountNumber = params.accountNumber || process.env.MOOLRE_ACCOUNT_NUMBER;

    if (!apiUser || !pubKey || !accountNumber) {
      throw new Error(
        "Moolre credentials missing. Configure them in Admin → Payment Settings."
      );
    }

    const payer = params.payer.replace(/\D/g, "").replace(/^0/, "233");
    const body: Record<string, unknown> = {
      type: 1,
      channel: params.channel ?? "13",
      currency: params.currency ?? "GHS",
      amount: params.amount,
      payer: payer.length >= 10 ? `0${payer.slice(-9)}` : params.payer,
      externalref: params.externalRef,
      accountnumber: accountNumber
    };
    if (params.callbackUrl) {
      body.callbackurl = params.callbackUrl;
      body.returnurl = params.callbackUrl;
    }

    const response = await fetch(`${MOOLRE_API}/open/transact/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-USER": apiUser,
        "X-API-PUBKEY": pubKey
      },
      body: JSON.stringify(body)
    });

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (data?.code === "TP14") {
      return { status: "otp_required", message: formatMessage(data?.message as string | string[] | undefined) || "OTP required." };
    }
    if (data?.code === "TR099") {
      return { status: "pending", message: formatMessage(data?.message as string | string[] | undefined) || "Payment prompt sent to user device." };
    }

    if (!response.ok) {
      throw new Error(formatMessage(data?.message as string | string[] | undefined) || "Moolre request failed.");
    }

    return { status: "success", data: data ?? {} };
  }
};
