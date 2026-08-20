import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import {
  getSmsSettings,
  saveSmsSettings,
  type SmsSettings
} from "@/backend/services/smsSettingsService";

const africastalkingSchema = z.object({
  username: z.string().optional().default(""),
  apiKey: z.string().optional().default(""),
  sandbox: z.boolean().optional().default(true)
});

const termiiSchema = z.object({
  apiKey: z.string().optional().default(""),
  senderId: z.string().optional().default("")
});

const bodySchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["africastalking", "termii"]).optional(),
  africastalking: africastalkingSchema.optional(),
  termii: termiiSchema.optional(),
  orderCompleteTemplate: z.string().optional(),
  walletTopUpTemplate: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const settings = await getSmsSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("SMS settings fetch error:", error);
    return NextResponse.json({ error: "Unable to load SMS settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid SMS settings payload." }, { status: 400 });
    }

    const userId = request.headers.get("x-user-id") ?? undefined;
    const updates: Partial<SmsSettings> = { ...parsed.data };
    const settings = await saveSmsSettings(updates, userId);
    return NextResponse.json(settings);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("SMS settings save error:", error);
    return NextResponse.json(
      { error: "Unable to save SMS settings.", details: process.env.NODE_ENV === "development" ? msg : undefined },
      { status: 500 }
    );
  }
}
