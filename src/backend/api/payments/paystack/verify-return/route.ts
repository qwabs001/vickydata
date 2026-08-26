import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { dispatchPaidPaystackOrder, verifyAndSettlePaystack } from "@/backend/services/payments/paystackSettlement";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref") || "";
  const base = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://vickydata.com";
  const target = new URL("/dashboard", base);
  let completed = false;
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { reference }, select: { metadata: true } });
    const path = (intent?.metadata as { returnPath?: string } | null)?.returnPath;
    if (path && ["/admin", "/agent", "/dashboard"].includes(path)) target.pathname = path;
    const result = await verifyAndSettlePaystack(reference);
    completed = result.status === "completed";
    await dispatchPaidPaystackOrder("orderId" in result ? result.orderId : undefined);
  } catch { /* Dashboard verification and webhook can safely retry. */ }
  target.searchParams.set("payment", completed ? "success" : "pending");
  target.searchParams.set("reference", reference);
  return NextResponse.redirect(target, 303);
}
