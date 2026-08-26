import { NextResponse } from "next/server";
import { GET as getMoolreStatus } from "@/backend/api/payments/moolre/status/route";
import { prisma } from "@/backend/lib/db/prisma";
import { dispatchPaidPaystackOrder, verifyAndSettlePaystack } from "@/backend/services/payments/paystackSettlement";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref") || url.searchParams.get("reference") || url.searchParams.get("trxref");
  if (!reference) return NextResponse.json({ error: "Reference is required." }, { status: 400 });
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { reference }, select: { provider: true } });
    if (intent?.provider === "MOOLRE") return getMoolreStatus(request);
    const result = await verifyAndSettlePaystack(reference);
    await dispatchPaidPaystackOrder("orderId" in result ? result.orderId : undefined);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to verify payment. Please retry." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const reference =
    typeof body?.reference === "string" && body.reference.trim().length > 0
      ? body.reference.trim()
      : typeof body?.ref === "string" && body.ref.trim().length > 0
        ? body.ref.trim()
        : "";

  if (!reference) {
    return NextResponse.json({ error: "Reference is required." }, { status: 400 });
  }

  const url = new URL(request.url);
  url.searchParams.set("ref", reference);
  return GET(new Request(url.toString(), { method: "GET" }));
}
