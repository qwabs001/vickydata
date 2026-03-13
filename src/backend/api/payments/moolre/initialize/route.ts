import { NextResponse } from "next/server";
import { z } from "zod";
import { createMoolreCheckout } from "@/backend/services/payments/moolreCheckoutService";

const bodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  ref: z.string().min(1),
  type: z.enum(["order", "wallet", "agent_upgrade"]).default("wallet"),
  // Order-specific fields (only needed for type: "order")
  networkId: z.string().optional(),
  dataPlanId: z.string().optional(),
  recipientNumber: z.string().optional(),
  rewardToUse: z.number().optional(),
  useWallet: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request. Required: userId, amount, ref." },
        { status: 400 }
      );
    }

    const result = await createMoolreCheckout({
      request,
      ...parsed.data
    });

    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    const message = err.message ?? "Unable to initialize payment.";
    console.error("[Moolre initialize]", message, error);
    return NextResponse.json({ error: message }, { status: err.statusCode ?? 500 });
  }
}
