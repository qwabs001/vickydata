import axios from "axios";
import { getSmsSettings } from "@/backend/services/smsSettingsService";

export type SendSmsResult = { ok: true } | { ok: false; error: string };

/**
 * Send an SMS to a phone number.
 * Uses the configured provider (Africa's Talking or Termii) from admin settings.
 */
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const settings = await getSmsSettings();
  if (!settings.enabled) return { ok: false, error: "SMS is disabled in settings." };
  if (!message?.trim()) return { ok: false, error: "Message is empty." };

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return { ok: false, error: `Invalid phone number: ${phone}. Use format 233XXXXXXXXX or 0XXXXXXXXX for Ghana.` };
  }

  try {
    if (settings.provider === "africastalking") {
      return await sendViaAfricasTalking(normalized, message, settings.africastalking);
    }
    if (settings.provider === "termii") {
      return await sendViaTermii(normalized, message, settings.termii);
    }
    return { ok: false, error: "Unknown SMS provider." };
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown; status?: number }; message?: string };
    const status = err.response?.status;
    const body = err.response?.data;
    let msg = err.message || "Unknown error";
    if (typeof body === "object" && body !== null && "errorMessage" in body) {
      msg = (body as { errorMessage?: string }).errorMessage || msg;
    } else if (typeof body === "string") {
      msg = body;
    } else if (status === 401) {
      msg = "Invalid API key. Check your Africa's Talking credentials.";
    } else if (status === 403) {
      msg = "Access denied. Verify your API key and sandbox/live mode.";
    }
    console.error("[SMS] Send error:", error);
    return { ok: false, error: msg };
  }
}

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  // Ghana: 233 + 9 digits
  if (digits.startsWith("233") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("2")) return `+233${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

async function sendViaAfricasTalking(
  to: string,
  message: string,
  config: { username: string; apiKey: string; sandbox: boolean }
): Promise<SendSmsResult> {
  if (!config.username?.trim() || !config.apiKey?.trim()) {
    return { ok: false, error: "Africa's Talking: username and API key are required." };
  }

  const base = config.sandbox
    ? "https://api.sandbox.africastalking.com"
    : "https://api.africastalking.com";
  const url = `${base}/version1/messaging`;

  const params = new URLSearchParams({
    username: config.username.trim(),
    to: to.replace("+", ""),
    message: message
  });

  const res = await axios.post(url, params.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      apikey: config.apiKey.trim()
    },
    timeout: 15_000
  });

  const data = res.data as {
    SMSMessageData?: {
      Recipients?: Array<{ status: string; statusCode?: number; errorMessage?: string }>;
      Message?: string;
    };
  };
  const recipients = data?.SMSMessageData?.Recipients;

  if (Array.isArray(recipients) && recipients.length > 0) {
    const first = recipients[0];
    if (first.status === "Success" || first.statusCode === 102) {
      return { ok: true };
    }
    const errMsg = first.errorMessage || first.status;
    if (config.sandbox && (errMsg.includes("Invalid") || errMsg.includes("recipient"))) {
      return {
        ok: false,
        error: "Sandbox: Register your number at simulator.africastalking.com first. Sandbox only delivers to simulator-registered numbers."
      };
    }
    return { ok: false, error: errMsg || "SMS delivery failed." };
  }

  const msg = (data?.SMSMessageData as { Message?: string })?.Message || JSON.stringify(data);
  return { ok: false, error: msg };
}

async function sendViaTermii(
  to: string,
  message: string,
  config: { apiKey: string; senderId: string }
): Promise<SendSmsResult> {
  if (!config.apiKey?.trim()) {
    return { ok: false, error: "Termii: API key is required." };
  }

  const url = "https://api.ng.termii.com/api/sms/send";
  const payload = {
    to: to.replace("+", ""),
    from: config.senderId?.trim() || "BundleArena",
    sms: message,
    type: "plain",
    channel: "dnd",
    api_key: config.apiKey.trim()
  };

  const res = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15_000
  });

  const data = res.data as { message_id?: string; code?: string; message?: string };
  if (res.status === 200 && (data?.message_id || data?.code === "ok")) {
    return { ok: true };
  }
  return { ok: false, error: data?.message || JSON.stringify(data) || "Termii delivery failed." };
}

export type SmsContext = {
  orderNumber?: string;
  planName?: string;
  recipient?: string;
  amount?: number;
  balance?: number;
};

/** Build SMS message from template with placeholders. */
export function buildSmsMessage(template: string, ctx: SmsContext): string {
  let out = template;
  if (ctx.orderNumber) out = out.replace(/\{\{orderNumber\}\}/g, ctx.orderNumber);
  if (ctx.planName) out = out.replace(/\{\{planName\}\}/g, ctx.planName);
  if (ctx.recipient) out = out.replace(/\{\{recipient\}\}/g, ctx.recipient);
  if (ctx.amount != null) out = out.replace(/\{\{amount\}\}/g, String(ctx.amount));
  if (ctx.balance != null) out = out.replace(/\{\{balance\}\}/g, String(ctx.balance));
  return out.replace(/\{\{[^}]+\}\}/g, "").trim();
}
