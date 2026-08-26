import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import {
  getPaymentSettings,
  savePaymentSettings,
  type PaymentSettings
} from "@/backend/services/paymentSettingsService";

const moolreSchema = z.object({
  apiUser: z.string().optional().default(""),
  pubKey: z.string().optional().default(""),
  secretKey: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  channel: z.string().optional().default("13"),
  currency: z.string().optional().default("GHS")
});

const paystackSchema = z.object({
  publicKey: z.string().optional().default(""),
  secretKey: z.string().optional().default(""),
  webhookSecret: z.string().optional().default(""),
  mode: z.enum(["Test", "Live"]).optional().default("Test")
});

const bodySchema = z.object({
  paystack: paystackSchema.optional(),
  moolre: moolreSchema.optional()
});

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const parsed = paystackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid Paystack settings." }, { status: 400 });
  const { publicKey, secretKey, mode } = parsed.data;
  const suffix = mode === "Live" ? "live_" : "test_";
  if (!publicKey.trim().startsWith("pk_" + suffix) || !secretKey.trim().startsWith("sk_" + suffix)) {
    return NextResponse.json({ error: "Both Paystack keys must match the selected mode." }, { status: 400 });
  }
  try {
    const response = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${secretKey.trim()}` }, signal: AbortSignal.timeout(10000), cache: "no-store"
    });
    const result = await response.json();
    if (!response.ok || !result.status) return NextResponse.json({ error: "Paystack rejected the secret key." }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Paystack accepted your secret key. Save to apply these settings." });
  } catch { return NextResponse.json({ error: "Paystack could not be reached. Please retry." }, { status: 503 }); }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const settings = await getPaymentSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Payment settings fetch error:", error);
    return NextResponse.json({ error: "Unable to load payment settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment settings payload." }, { status: 400 });
    }

    const userId = request.headers.get("x-user-id") ?? undefined;
    const updates: Partial<PaymentSettings> = {};
    if (parsed.data.paystack) updates.paystack = parsed.data.paystack as PaymentSettings["paystack"];
    if (parsed.data.moolre) updates.moolre = parsed.data.moolre as PaymentSettings["moolre"];

    const settings = await savePaymentSettings(updates, userId);
    return NextResponse.json(settings);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Payment settings save error:", error);
    return NextResponse.json(
      { error: "Unable to save payment settings.", details: process.env.NODE_ENV === "development" ? msg : undefined },
      { status: 500 }
    );
  }
}
