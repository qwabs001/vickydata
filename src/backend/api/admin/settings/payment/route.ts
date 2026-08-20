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
