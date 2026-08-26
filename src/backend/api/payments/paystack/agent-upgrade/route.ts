import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaystackCheckout } from "@/backend/services/payments/paystackCheckoutService";

const bodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive().optional(),
  currency: z.string().default("GHS"),
  ref: z.string().min(1)
});

const AGENT_UPGRADE_FEE = 100;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request. Required: userId and ref." },
        { status: 400 }
      );
    }

    const result = await createPaystackCheckout({
      request,
      userId: parsed.data.userId,
      amount: AGENT_UPGRADE_FEE,
      currency: parsed.data.currency,
      ref: parsed.data.ref,
      type: "agent_upgrade"
    });

    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    return NextResponse.json(
      { error: err.message ?? "Unable to initialize payment." },
      { status: err.statusCode ?? 500 }
    );
  }
}
