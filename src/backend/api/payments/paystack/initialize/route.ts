import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaystackCheckout } from "@/backend/services/payments/paystackCheckoutService";

const schema = z.object({ userId: z.string().min(1), amount: z.number().finite().positive(),
  currency: z.literal("GHS").default("GHS"), ref: z.string().min(1).max(200),
  type: z.enum(["order", "wallet", "agent_upgrade"]).default("wallet"),
  networkId: z.string().optional(), dataPlanId: z.string().optional(), recipientNumber: z.string().optional(),
  rewardToUse: z.number().nonnegative().optional(), useWallet: z.boolean().optional() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment details." }, { status: 400 });
  try { return NextResponse.json(await createPaystackCheckout({ request, ...parsed.data })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open Paystack checkout." }, { status: 400 }); }
}
