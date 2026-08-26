import { NextResponse } from "next/server";
import { getPaystackSecret } from "@/backend/services/payments/paystackCheckoutService";
import { validPaystackSignature } from "@/backend/services/payments/paystackRules";
import { dispatchPaidPaystackOrder, verifyAndSettlePaystack } from "@/backend/services/payments/paystackSettlement";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const secret = await getPaystackSecret();
    if (!validPaystackSignature(body, request.headers.get("x-paystack-signature") ?? "", secret)) {
      return NextResponse.json({ received: false }, { status: 401 });
    }
    let event;
    try { event = JSON.parse(body); } catch { return NextResponse.json({ received: false }, { status: 400 }); }
    if (event.event !== "charge.success") return NextResponse.json({ received: true });
    const reference = event.data?.reference;
    if (typeof reference !== "string" || !reference) return NextResponse.json({ received: false }, { status: 400 });
    const result = await verifyAndSettlePaystack(reference);
    if (result.status === "pending") return NextResponse.json({ received: false }, { status: 503 });
    await dispatchPaidPaystackOrder("orderId" in result ? result.orderId : undefined);
    return NextResponse.json({ received: true });
  } catch {
    console.error("Paystack webhook verification/settlement failed; retry required.");
    return NextResponse.json({ received: false }, { status: 503 });
  }
}
