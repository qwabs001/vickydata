import { NextResponse } from "next/server";
import { prisma } from "@/backend/lib/db/prisma";
import { requireAdmin } from "@/backend/lib/middleware/admin";
import { dataProviderService } from "@/backend/services/dataProvider/dataProviderService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json({ ok: true, order, message: "Order already completed." });
    }

    const fulfillResult = await dataProviderService.fulfillOrder(id);

    if (fulfillResult.ok) {
      const updated = await prisma.order.findUnique({ where: { id } });
      return NextResponse.json({
        ok: true,
        order: updated,
        reference: fulfillResult.reference
      });
    }

    return NextResponse.json(
      { error: fulfillResult.error ?? "Fulfillment failed." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Order complete error:", error);
    return NextResponse.json(
      { error: "Unable to complete order." },
      { status: 500 }
    );
  }
}
