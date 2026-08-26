import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createPaystackCheckout } from "@/backend/services/payments/paystackCheckoutService";

// Wallet funding must be verified; never credit a submitted amount directly.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.userId !== "string" || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
    return NextResponse.json({ error: "Invalid wallet top-up." }, { status: 400 });
  }
  try { return NextResponse.json(await createPaystackCheckout({ request, userId: body.userId, amount: body.amount, ref: `WALLET-${randomUUID()}`, type: "wallet" })); }
  catch { return NextResponse.json({ error: "Unable to open Paystack checkout." }, { status: 400 }); }
}
